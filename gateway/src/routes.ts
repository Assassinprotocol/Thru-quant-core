import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { type DatabaseClient, type FeedSnapshotRecord, calculateTwap } from "@thru-quant/indexer";
import type { FeedResponse, RiskResponse, ProvenanceResponse } from "./types.ts";

export const REGIME_NAMES: Record<number, string> = {
  0: "CALM",
  1: "ELEVATED_VOL",
  2: "EXTREME_DISPERSION",
};

export const SYMBOL_ID_LOOKUP: Record<string, number> = {
  "0": 1,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "BTC": 1,
  "BTC/USD": 1,
  "BTCUSD": 1,
  "BTCUSDT": 1,
  "ETH": 2,
  "ETH/USD": 2,
  "ETHUSD": 2,
  "ETHUSDT": 2,
  "SOL": 3,
  "SOL/USD": 3,
  "SOLUSD": 3,
  "SOLUSDT": 3,
  "USDT": 4,
  "USDT/USD": 4,
  "USDTUSD": 4,
  "USDC": 5,
  "USDC/USD": 5,
  "USDCUSD": 5,
  "THRU": 6,
  "THRU/USD": 6,
  "THRUUSD": 6,
  "WTHRUUSD": 6,
  "BTC-USD": 1,
  "BTC_USD": 1,
  "ETH-USD": 2,
  "ETH_USD": 2,
  "SOL-USD": 3,
  "SOL_USD": 3,
  "USDT-USD": 4,
  "USDT_USD": 4,
  "USDC-USD": 5,
  "USDC_USD": 5,
  "THRU-USD": 6,
  "THRU_USD": 6,
};

export function resolveSymbolId(raw: string): number | undefined {
  const clean = decodeURIComponent(raw).trim().toUpperCase();
  if (SYMBOL_ID_LOOKUP[clean] !== undefined) {
    return SYMBOL_ID_LOOKUP[clean];
  }
  const normalized = clean.replace(/[-_]/g, "/");
  if (SYMBOL_ID_LOOKUP[normalized] !== undefined) {
    return SYMBOL_ID_LOOKUP[normalized];
  }
  return undefined;
}

export function formatFeedResponse(s: FeedSnapshotRecord): FeedResponse {
  const nowTs = Math.floor(Date.now() / 1000);
  const ageSeconds = Math.max(0, nowTs - Number(s.medianSourceTs));
  const confFraction = s.confidenceBps / 10000;
  const lowerBound = Number((s.price * (1 - confFraction)).toFixed(8));
  const upperBound = Number((s.price * (1 + confFraction)).toFixed(8));

  const isStale = (s.flags & 1) !== 0 || ageSeconds > 60;
  const isBigMove = (s.flags & 2) !== 0;
  const isLowConfidence = (s.flags & 4) !== 0;
  const hadOutlierRejected = (s.flags & 8) !== 0;

  return {
    symbolId: s.symbolId,
    symbol: s.symbol,
    price: s.price,
    priceRaw: s.priceRaw.toString(),
    confidenceBps: s.confidenceBps,
    confidenceLowerBound: lowerBound,
    confidenceUpperBound: upperBound,
    publishSlot: s.publishSlot.toString(),
    prevPublishSlot: s.prevPublishSlot.toString(),
    medianSourceTs: s.medianSourceTs.toString(),
    ageSeconds,
    contributorCount: s.contributorCount,
    contributorMask: s.contributorMask,
    flags: s.flags,
    isStale,
    isBigMove,
    isLowConfidence,
    hadOutlierRejected,
    provenance: {
      slot: s.publishSlot.toString(),
      accountAddress: `feed-v2-${s.symbolId}`,
      magic: "0x54464545",
    },
  };
}

export function serializeFeedAccountView(s: FeedSnapshotRecord): Uint8Array {
  const buf = new Uint8Array(88);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  view.setUint32(0, 0x54464545, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, s.symbolId, true);
  view.setUint32(12, 1, true);
  view.setBigUint64(16, s.priceRaw, true);
  view.setBigUint64(24, s.priceRaw, true);
  view.setBigUint64(32, BigInt(s.confidenceBps), true);
  view.setBigUint64(40, s.publishSlot, true);
  view.setBigUint64(48, s.prevPublishSlot, true);
  view.setBigUint64(56, s.medianSourceTs, true);
  view.setUint32(64, s.contributorCount, true);
  view.setUint32(68, s.flags, true);
  buf[72] = s.contributorMask;
  return buf;
}

export function registerRoutes(app: FastifyInstance, db: DatabaseClient) {
  const startTime = Date.now();

  app.get("/v2/health", async () => {
    const cp = await db.getCheckpoint("betanet");
    return {
      status: "ok",
      version: "2.0.0",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      syncedSlot: cp ? cp.lastProcessedSlot.toString() : "0",
    };
  });

  app.get("/v2/feeds", async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { strict?: string };
    const strictMode =
      query.strict === "true" ||
      req.headers["x-oracle-mode"] === "strict";

    const snapshots = await db.listSnapshots();
    const formatted = snapshots.map(formatFeedResponse);

    if (strictMode) {
      const hasStale = formatted.some((f) => f.ageSeconds > 60 || f.isStale);
      if (hasStale) {
        reply.status(412);
        return {
          error: "Precondition Failed: Stale feed detected under strict mode",
          code: "ORACLE_STRICT_MODE_STALE",
          feeds: formatted,
        };
      }
    }

    const latestSlot = formatted.reduce(
      (max, f) => (BigInt(f.publishSlot) > BigInt(max) ? f.publishSlot : max),
      "0"
    );
    reply.header("x-oracle-slot", latestSlot);
    reply.header("x-oracle-version", "2");

    return {
      data: formatted,
      count: formatted.length,
      serverTime: new Date().toISOString(),
    };
  });

  const handleGetFeed = async (symbolParam: string, reply: FastifyReply) => {
    const symbolId = resolveSymbolId(symbolParam);
    if (symbolId === undefined) {
      reply.status(404);
      return { error: `Feed not found for symbol: ${symbolParam}`, code: "ORACLE_FEED_NOT_FOUND" };
    }

    const snapshot = await db.getSnapshot(symbolId);
    if (!snapshot) {
      reply.status(404);
      return { error: `No data published yet for symbol: ${symbolParam}`, code: "ORACLE_FEED_NO_DATA" };
    }

    const formatted = formatFeedResponse(snapshot);
    reply.header("x-oracle-slot", formatted.publishSlot);
    return { data: formatted };
  };

  app.get("/v2/feeds/:symbol", async (req: FastifyRequest<{ Params: { symbol: string } }>, reply: FastifyReply) => {
    return handleGetFeed(req.params.symbol, reply);
  });

  app.get("/v2/feeds/:base/:quote", async (req: FastifyRequest<{ Params: { base: string; quote: string } }>, reply: FastifyReply) => {
    return handleGetFeed(`${req.params.base}/${req.params.quote}`, reply);
  });

  const handleGetHistory = async (symbolParam: string, limitQuery: string | undefined, reply: FastifyReply) => {
    const symbolId = resolveSymbolId(symbolParam);
    if (symbolId === undefined) {
      reply.status(404);
      return { error: `Symbol not found: ${symbolParam}` };
    }

    const limit = Math.min(100, Math.max(1, parseInt(limitQuery || "20", 10)));
    const prices = await db.getRecentPrices(symbolId, limit);

    return {
      symbol: symbolParam,
      symbolId,
      points: prices.length,
      prices,
    };
  };

  app.get("/v2/feeds/:symbol/history", async (req: FastifyRequest<{ Params: { symbol: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    return handleGetHistory(req.params.symbol, req.query.limit, reply);
  });

  app.get("/v2/feeds/:base/:quote/history", async (req: FastifyRequest<{ Params: { base: string; quote: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    return handleGetHistory(`${req.params.base}/${req.params.quote}`, req.query.limit, reply);
  });

  const handleGetTwap = async (symbolParam: string, limitQuery: string | undefined, reply: FastifyReply) => {
    const symbolId = resolveSymbolId(symbolParam);
    if (symbolId === undefined) {
      reply.status(404);
      return { error: `Symbol not found: ${symbolParam}`, code: "ORACLE_FEED_NOT_FOUND" };
    }

    const limit = Math.min(100, Math.max(1, parseInt(limitQuery || "30", 10)));
    const prices = await db.getRecentPrices(symbolId, limit);
    const snapshot = await db.getSnapshot(symbolId);

    const effectivePrices = prices.length > 0 ? prices : (snapshot ? [snapshot.price] : []);
    const twapData = calculateTwap(effectivePrices);

    return {
      symbol: symbolParam,
      symbolId,
      twap: twapData.twap,
      samples: twapData.samples,
      minPrice: twapData.minPrice,
      maxPrice: twapData.maxPrice,
      currentPrice: snapshot ? snapshot.price : (effectivePrices[effectivePrices.length - 1] ?? 0),
      publishSlot: snapshot ? snapshot.publishSlot.toString() : "0",
    };
  };

  app.get("/v2/feeds/:symbol/twap", async (req: FastifyRequest<{ Params: { symbol: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    return handleGetTwap(req.params.symbol, req.query.limit, reply);
  });

  app.get("/v2/feeds/:base/:quote/twap", async (req: FastifyRequest<{ Params: { base: string; quote: string }; Querystring: { limit?: string } }>, reply: FastifyReply) => {
    return handleGetTwap(`${req.params.base}/${req.params.quote}`, req.query.limit, reply);
  });

  const handleGetAttestation = async (symbolParam: string, reply: FastifyReply) => {
    const symbolId = resolveSymbolId(symbolParam);
    if (symbolId === undefined) {
      reply.status(404);
      return { error: `Symbol not found: ${symbolParam}`, code: "ORACLE_FEED_NOT_FOUND" };
    }

    const snapshot = await db.getSnapshot(symbolId);
    if (!snapshot) {
      reply.status(404);
      return { error: `No data published yet for symbol: ${symbolParam}`, code: "ORACLE_FEED_NO_DATA" };
    }

    const wireBytes = serializeFeedAccountView(snapshot);
    const wireHex = Buffer.from(wireBytes).toString("hex");
    const wireBase64 = Buffer.from(wireBytes).toString("base64");
    const sha256 = crypto.createHash("sha256").update(wireBytes).digest("hex");

    return {
      symbol: snapshot.symbol,
      symbolId: snapshot.symbolId,
      publishSlot: snapshot.publishSlot.toString(),
      price: snapshot.price,
      priceRaw: snapshot.priceRaw.toString(),
      confidenceBps: snapshot.confidenceBps,
      wireSizeBytes: wireBytes.length,
      binaryWireHex: wireHex,
      binaryWireBase64: wireBase64,
      sha256,
    };
  };

  app.get("/v2/feeds/:symbol/attestation", async (req: FastifyRequest<{ Params: { symbol: string } }>, reply: FastifyReply) => {
    return handleGetAttestation(req.params.symbol, reply);
  });

  app.get("/v2/feeds/:base/:quote/attestation", async (req: FastifyRequest<{ Params: { base: string; quote: string } }>, reply: FastifyReply) => {
    return handleGetAttestation(`${req.params.base}/${req.params.quote}`, reply);
  });

  const handleStream = async (symbolParam: string, reply: FastifyReply) => {
    const symbolId = resolveSymbolId(symbolParam);
    if (symbolId === undefined) {
      reply.status(404);
      return { error: `Symbol not found: ${symbolParam}` };
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");

    const snapshot = await db.getSnapshot(symbolId);
    if (snapshot) {
      const initial = formatFeedResponse(snapshot);
      reply.raw.write(`event: feed\ndata: ${JSON.stringify(initial)}\n\n`);
    }

    reply.raw.write(`event: ping\ndata: {"time":"${new Date().toISOString()}"}\n\n`);
    reply.raw.end();
  };

  app.get("/v2/feeds/:symbol/stream", async (req: FastifyRequest<{ Params: { symbol: string } }>, reply: FastifyReply) => {
    return handleStream(req.params.symbol, reply);
  });

  app.get("/v2/feeds/:base/:quote/stream", async (req: FastifyRequest<{ Params: { base: string; quote: string } }>, reply: FastifyReply) => {
    return handleStream(`${req.params.base}/${req.params.quote}`, reply);
  });

  app.get("/v2/risk", async () => {
    const snapshots = await db.listSnapshots();
    const signals: RiskResponse[] = [];

    for (const s of snapshots) {
      const sig = await db.getLatestRiskSignal(s.symbolId);
      if (sig) {
        signals.push({
          symbolId: sig.symbolId,
          symbol: sig.symbol,
          slot: sig.slot.toString(),
          rollingVol30mBps: sig.rollingVol30mBps,
          rollingVol1hBps: sig.rollingVol1hBps,
          rollingVol24hBps: sig.rollingVol24hBps,
          regime: REGIME_NAMES[sig.regimeId] || "UNKNOWN",
          regimeId: sig.regimeId,
          depegBps: sig.depegBps,
          updatedAt: sig.createdAt ? sig.createdAt.toISOString() : new Date().toISOString(),
        });
      }
    }

    return {
      data: signals,
      count: signals.length,
      evaluatedAt: new Date().toISOString(),
    };
  });

  app.get("/v2/provenance/:slot", async (req: FastifyRequest<{ Params: { slot: string } }>, reply: FastifyReply) => {
    const slot = req.params.slot;
    const snapshots = await db.listSnapshots();

    const matched = snapshots.filter((s) => s.publishSlot.toString() === slot);

    const provenance: ProvenanceResponse = {
      slot,
      verified: matched.length > 0,
      symbolCount: matched.length,
      feedMagic: "0x54464545",
      programId: "thru-oracle-v2-betanet",
      timestamp: new Date().toISOString(),
    };

    return { data: provenance };
  });

  app.get("/v2/publishers", async () => {
    return {
      tier: "T2",
      minQuorum: 3,
      maxPublishers: 7,
      activeCount: 3,
      publishers: [
        {
          id: "pub_01",
          name: "Thru Foundation Primary",
          pubkey: "taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR",
          region: "ap-southeast-1",
          uptimePercent: 99.98,
          slotsParticipated: 14280,
          lastSlot: 1492250,
          medianDeltaBps: 1.2,
          status: "ACTIVE",
        },
        {
          id: "pub_02",
          name: "Sovereign Node EU",
          pubkey: "taQbv8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN",
          region: "eu-central-1",
          uptimePercent: 99.85,
          slotsParticipated: 14261,
          lastSlot: 1492249,
          medianDeltaBps: 2.1,
          status: "ACTIVE",
        },
        {
          id: "pub_03",
          name: "Validator Guild US",
          pubkey: "taKmn7gB1Whl5nBG1YqWj0oKJMVL8bPbdfRnikkn1JB",
          region: "us-east-1",
          uptimePercent: 99.42,
          slotsParticipated: 14205,
          lastSlot: 1492248,
          medianDeltaBps: 3.5,
          status: "ACTIVE",
        },
      ],
    };
  });

  app.get("/metrics", async (_req: FastifyRequest, reply: FastifyReply) => {
    const snapshots = await db.listSnapshots();
    const lines: string[] = [
      "# HELP thru_oracle_v2_price Latest canonical consensus price in USD",
      "# TYPE thru_oracle_v2_price gauge",
    ];

    for (const s of snapshots) {
      const sym = s.symbol.replace("/", "_");
      lines.push(`thru_oracle_v2_price{symbol="${sym}"} ${s.price}`);
    }

    lines.push(
      "# HELP thru_oracle_v2_confidence_bps Median Absolute Deviation confidence in basis points",
      "# TYPE thru_oracle_v2_confidence_bps gauge"
    );
    for (const s of snapshots) {
      const sym = s.symbol.replace("/", "_");
      lines.push(`thru_oracle_v2_confidence_bps{symbol="${sym}"} ${s.confidenceBps}`);
    }

    lines.push(
      "# HELP thru_oracle_v2_flags On-chain risk and consensus status bitflags",
      "# TYPE thru_oracle_v2_flags gauge"
    );
    for (const s of snapshots) {
      const sym = s.symbol.replace("/", "_");
      lines.push(`thru_oracle_v2_flags{symbol="${sym}"} ${s.flags}`);
    }

    reply.header("Content-Type", "text/plain; version=0.0.4");
    return lines.join("\n") + "\n";
  });
}
