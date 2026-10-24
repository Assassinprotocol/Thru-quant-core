import {
  type OracleClientOptions,
  type OracleState,
  type OracleEntry,
  type RiskGateOptions,
  type RiskEvaluationResult,
  type LatestPriceOptions,
  type LatestPriceResult,
  type SafeValuationOptions,
  type SafeValuationResult,
} from "./types.ts";
import { decodeOracleAccount, decodeOracleBase64 } from "./decoder.ts";
import { evaluateRiskGate } from "./guards.ts";

const DEFAULT_ACCOUNT_ADDRESS =
  "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN";
const DEFAULT_PROGRAM_ID =
  "taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR";
const DEFAULT_DAEMON_URL = "http://localhost:8080";
const DEFAULT_RPC_URL = "https://rpc.betanet.thru.org";

export class OracleClient {
  private rpcUrl: string;
  private daemonUrl: string;
  private accountAddress: string;
  private programId: string;
  private timeoutMs: number;

  constructor(options: OracleClientOptions = {}) {
    this.rpcUrl = options.rpcUrl || DEFAULT_RPC_URL;
    this.daemonUrl = options.daemonUrl || DEFAULT_DAEMON_URL;
    this.accountAddress = options.accountAddress || DEFAULT_ACCOUNT_ADDRESS;
    this.programId = options.programId || DEFAULT_PROGRAM_ID;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Fetches latest Oracle state from the local Daemon or falls back to direct JSON-RPC.
   */
  async getLatestState(): Promise<OracleState> {
    try {
      return await this.fetchFromDaemon();
    } catch (_daemonErr) {
      return await this.fetchFromRpc();
    }
  }

  /**
   * Fetches latest quote for a specific ticker symbol (O(1) lookup).
   */
  async getQuote(symbol: string): Promise<OracleEntry> {
    const state = await this.getLatestState();
    const quote = state.bySymbol[symbol];
    if (!quote) {
      throw new Error(`Symbol '${symbol}' not found in Oracle active registry`);
    }
    return quote;
  }

  /**
   * Evaluates operational readiness probe (/ready).
   */
  async isReady(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(`${this.daemonUrl}/ready`, {
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) return false;
      const data = (await res.json()) as { ready?: boolean };
      return !!data.ready;
    } catch (_e) {
      // Fallback: query state and verify freshness
      try {
        const state = await this.fetchFromRpc();
        return !state.circuitBreakerActive && state.feedAgeSec <= 120;
      } catch {
        return false;
      }
    }
  }

  /**
   * Evaluates risk gate policies for a specific asset against live on-chain state.
   */
  async checkRiskGate(
    symbol: string,
    options?: RiskGateOptions
  ): Promise<RiskEvaluationResult> {
    const state = await this.getLatestState();
    return evaluateRiskGate(state, symbol, options);
  }

  /**
   * Fetches state directly from the local Go HTTP Daemon (/v1/oracle/latest).
   */
  async fetchFromDaemon(): Promise<OracleState> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    const res = await fetch(`${this.daemonUrl}/v1/oracle/latest`, {
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`Daemon error: HTTP ${res.status}`);
    }

    const json = (await res.json()) as OracleState;
    // Ensure indexed lookups are initialized
    if (!json.bySymbol || !json.byId) {
      json.bySymbol = {};
      json.byId = {};
      for (const entry of json.entries || []) {
        json.bySymbol[entry.symbol] = entry;
        json.byId[entry.symbolId] = entry;
      }
    }
    return json;
  }

  /**
   * Fetches and deserializes state directly from Thru Betanet JSON-RPC.
   */
  async fetchFromRpc(): Promise<OracleState> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    const payload = {
      jsonrpc: "2.0",
      id: 1,
      method: "thru_getAccountInfo",
      params: [this.accountAddress, { encoding: "base64" }],
    };

    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`Thru RPC HTTP error: ${res.status}`);
    }

    const data = (await res.json()) as {
      result?: { data?: string | string[]; owner?: string };
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`Thru RPC error: ${data.error.message}`);
    }

    if (data.result?.owner && data.result.owner !== this.programId) {
      throw new Error(
        `Thru RPC security check failed: account owner '${data.result.owner}' does not match expected program '${this.programId}'`
      );
    }

    let b64 = "";
    if (typeof data.result?.data === "string") {
      b64 = data.result.data;
    } else if (Array.isArray(data.result?.data) && data.result.data.length > 0) {
      b64 = data.result.data[0];
    } else {
      throw new Error("Invalid or empty account data returned by Thru RPC");
    }

    return decodeOracleBase64(b64);
  }

  async getLatestPrice(
    symbol: string,
    options?: LatestPriceOptions
  ): Promise<LatestPriceResult> {
    const cleanSym = symbol.trim().toUpperCase();
    const encoded = cleanSym.includes("/") ? cleanSym : `${cleanSym}/USD`;

    try {
      const headers: Record<string, string> = {};
      if (options?.strict) {
        headers["X-Oracle-Mode"] = "strict";
      }

      const res = await fetch(`${this.daemonUrl}/v2/feeds/${encoded}`, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (res.status === 412) {
        throw new Error(`Feed '${symbol}' is stale (exceeds freshness SLA under strict mode)`);
      }

      if (!res.ok) {
        throw new Error(`Gateway v2 returned status ${res.status}`);
      }

      const raw = (await res.json()) as any;
      const data = raw.data ?? raw;
      const price = Number(data.price);
      const conf = Number(
        data.confidence !== undefined
          ? data.confidence
          : (data.confidenceBps !== undefined ? (price * data.confidenceBps) / 10000 : 0)
      );
      const slot = Number(data.slot ?? data.publishSlot ?? 0);
      const ts = Number(data.timestamp ?? data.medianSourceTs ?? Math.floor(Date.now() / 1000));
      const flags = Number(data.flags ?? 0);
      const flagsList = Array.isArray(data.flagsList)
        ? data.flagsList
        : (flags === 0 ? ["VALID"] : []);

      return {
        symbol: data.symbol,
        price,
        confidence: conf,
        slot,
        timestamp: ts,
        flags,
        flagsList,
        publishersCount: data.publishersCount ?? data.contributorCount,
        totalPublishers: data.totalPublishers ?? data.contributorCount,
      };
    } catch (v2Err: any) {
      if (v2Err.message?.includes("stale")) throw v2Err;

      // Fallback to v1 state query
      const quote = await this.getQuote(cleanSym.replace("/USD", ""));
      return {
        symbol: quote.symbol,
        price: Number(quote.priceDecimal),
        confidence: Number(quote.priceDecimal) * (quote.volatilityBps / 10000),
        slot: 0,
        timestamp: quote.timestamp,
        flags: 0,
        flagsList: ["VALID"],
      };
    }
  }

  watchFeed(
    symbol: string,
    callback: (update: LatestPriceResult) => void
  ): () => void {
    const controller = new AbortController();
    const cleanSym = symbol.trim().toUpperCase();
    const encoded = cleanSym.includes("/") ? cleanSym : `${cleanSym}/USD`;
    const streamUrl = `${this.daemonUrl}/v2/feeds/${encoded}/stream`;

    (async () => {
      try {
        const res = await fetch(streamUrl, {
          signal: controller.signal,
          headers: { Accept: "text/event-stream" },
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const block of lines) {
            const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
            if (dataLine) {
              try {
                const raw = JSON.parse(dataLine.slice(6));
                const parsed = raw.data ?? raw;
                const price = Number(parsed.price);
                const conf = Number(
                  parsed.confidence !== undefined
                    ? parsed.confidence
                    : (parsed.confidenceBps !== undefined ? (price * parsed.confidenceBps) / 10000 : 0)
                );
                callback({
                  symbol: parsed.symbol,
                  price,
                  confidence: conf,
                  slot: Number(parsed.slot ?? parsed.publishSlot ?? 0),
                  timestamp: Number(parsed.timestamp ?? parsed.medianSourceTs ?? Math.floor(Date.now() / 1000)),
                  flags: Number(parsed.flags ?? 0),
                  flagsList: Array.isArray(parsed.flagsList) ? parsed.flagsList : ["VALID"],
                });
              } catch {
                // Ignore SSE heartbeat or non-json message
              }
            }
          }
        }
      } catch {
        // Stream aborted or connection lost
      }
    })();

    return () => controller.abort();
  }

  async calculateSafeValuation(
    symbol: string,
    positionType: "collateral" | "debt",
    options?: SafeValuationOptions
  ): Promise<SafeValuationResult> {
    const quote = await this.getLatestPrice(symbol, { strict: options?.strict });
    const k = options?.k ?? 1.0;
    const band = k * quote.confidence;

    const safePrice =
      positionType === "collateral"
        ? Math.max(0, quote.price - band)
        : quote.price + band;

    return {
      symbol: quote.symbol,
      positionType,
      safePrice,
      rawPrice: quote.price,
      confidence: quote.confidence,
      slot: quote.slot,
      k,
    };
  }

  async getTwap(
    symbol: string,
    limit: number = 30
  ): Promise<{
    symbol: string;
    symbolId: number;
    twap: number;
    samples: number;
    minPrice: number;
    maxPrice: number;
    currentPrice: number;
    publishSlot: string;
  }> {
    const cleanSym = symbol.trim().toUpperCase();
    const encoded = cleanSym.includes("/") ? cleanSym : `${cleanSym}/USD`;
    const res = await fetch(`${this.daemonUrl}/v2/feeds/${encoded}/twap?limit=${limit}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch TWAP for ${symbol}: HTTP ${res.status}`);
    }
    return (await res.json()) as any;
  }

  async getAttestation(
    symbol: string
  ): Promise<{
    symbol: string;
    symbolId: number;
    publishSlot: string;
    price: number;
    priceRaw: string;
    confidenceBps: number;
    wireSizeBytes: number;
    binaryWireHex: string;
    binaryWireBase64: string;
    sha256: string;
  }> {
    const cleanSym = symbol.trim().toUpperCase();
    const encoded = cleanSym.includes("/") ? cleanSym : `${cleanSym}/USD`;
    const res = await fetch(`${this.daemonUrl}/v2/feeds/${encoded}/attestation`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch attestation for ${symbol}: HTTP ${res.status}`);
    }
    return (await res.json()) as any;
  }

  async getLatestPriceUpdates(symbols: string[]): Promise<{
    slot: string;
    timestamp: number;
    symbols: string[];
    count: number;
    unresolved?: string[];
    binary: {
      encoding: string;
      data: string[];
      combinedHex: string;
      totalSizeBytes: number;
      sha256: string;
    };
    parsed: LatestPriceResult[];
  }> {
    if (!symbols || symbols.length === 0) {
      throw new Error("symbols array must contain at least one symbol");
    }
    const symList = symbols.map(s => s.trim().toUpperCase()).join(",");
    const res = await fetch(`${this.daemonUrl}/v2/updates/price/latest?symbols=${encodeURIComponent(symList)}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch batched price updates: HTTP ${res.status}`);
    }
    const json = (await res.json()) as any;
    const parsed: LatestPriceResult[] = (json.parsed || []).map((item: any) => {
      const price = Number(item.price);
      const conf = Number(
        item.confidence !== undefined
          ? item.confidence
          : (item.confidenceBps !== undefined ? (price * item.confidenceBps) / 10000 : 0)
      );
      const flags = Number(item.flags ?? 0);
      const flagsList = Array.isArray(item.flagsList)
        ? item.flagsList
        : (flags === 0 ? ["VALID"] : []);
      return {
        symbol: item.symbol,
        price,
        confidence: conf,
        slot: Number(item.slot ?? item.publishSlot ?? 0),
        timestamp: Number(item.timestamp ?? item.medianSourceTs ?? Math.floor(Date.now() / 1000)),
        flags,
        flagsList,
        publishersCount: item.publishersCount ?? item.contributorCount,
        totalPublishers: item.totalPublishers ?? item.contributorCount,
      };
    });
    return {
      slot: String(json.slot),
      timestamp: Number(json.timestamp),
      symbols: json.symbols || [],
      count: Number(json.count || parsed.length),
      unresolved: json.unresolved,
      binary: json.binary,
      parsed,
    };
  }

  async getBenchmarkPrice(
    symbol: string,
    slot: number | bigint
  ): Promise<{
    symbol: string;
    symbolId: number;
    publishSlot: string;
    price: number;
    priceRaw: string;
    confidenceBps: number;
    medianSourceTs: string;
    flags: number;
    verified: boolean;
    source: string;
  }> {
    const slotStr = String(slot).trim();
    if (!/^\d+$/.test(slotStr)) {
      throw new Error(`Invalid slot parameter: ${slot}`);
    }
    const cleanSym = symbol.trim().toUpperCase();
    const encoded = cleanSym.includes("/") ? cleanSym : `${cleanSym}/USD`;
    const res = await fetch(`${this.daemonUrl}/v2/feeds/${encoded}/benchmark?slot=${slotStr}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch benchmark for ${symbol} at slot ${slot}: HTTP ${res.status}`);
    }
    return (await res.json()) as any;
  }

  async getCrossRate(
    baseSymbol: string,
    quoteSymbol: string
  ): Promise<{
    data: LatestPriceResult;
    derived: boolean;
    formula: string;
  }> {
    const base = baseSymbol.trim().toUpperCase();
    const quote = quoteSymbol.trim().toUpperCase();
    if (base === quote) {
      throw new Error("Base and quote symbols must be distinct");
    }
    const res = await fetch(`${this.daemonUrl}/v2/feeds/${base}/${quote}`, {
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch cross rate ${base}/${quote}: HTTP ${res.status}`);
    }
    const json = (await res.json()) as any;
    const rawData = json.data ?? json;
    const price = Number(rawData.price);
    const conf = Number(
      rawData.confidence !== undefined
        ? rawData.confidence
        : (rawData.confidenceBps !== undefined ? (price * rawData.confidenceBps) / 10000 : 0)
    );
    const flags = Number(rawData.flags ?? 0);
    const flagsList = Array.isArray(rawData.flagsList)
      ? rawData.flagsList
      : (flags === 0 ? ["VALID"] : []);

    return {
      data: {
        symbol: rawData.symbol,
        price,
        confidence: conf,
        slot: Number(rawData.slot ?? rawData.publishSlot ?? 0),
        timestamp: Number(rawData.timestamp ?? rawData.medianSourceTs ?? Math.floor(Date.now() / 1000)),
        flags,
        flagsList,
        publishersCount: rawData.publishersCount ?? rawData.contributorCount,
        totalPublishers: rawData.totalPublishers ?? rawData.contributorCount,
      },
      derived: Boolean(json.derived ?? true),
      formula: String(json.formula ?? `${base}/USD / ${quote}/USD`),
    };
  }

  calculatePerpMarkPrice(
    indexPrice: number,
    orderBookMedian: number,
    maxDeviationBps: number = 300
  ): {
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    isClamped: boolean;
  } {
    if (!Number.isFinite(indexPrice) || indexPrice <= 0 || !Number.isFinite(orderBookMedian) || orderBookMedian <= 0) {
      const safeIndex = Number.isFinite(indexPrice) && indexPrice > 0 ? indexPrice : 0;
      return { markPrice: safeIndex, indexPrice: safeIndex, fundingRate: 0, isClamped: false };
    }
    const maxDelta = (indexPrice * maxDeviationBps) / 10000;
    const rawDelta = orderBookMedian - indexPrice;
    let clampedDelta = rawDelta;
    let isClamped = false;
    if (rawDelta > maxDelta) {
      clampedDelta = maxDelta;
      isClamped = true;
    } else if (rawDelta < -maxDelta) {
      clampedDelta = -maxDelta;
      isClamped = true;
    }
    const markPrice = Math.max(0, indexPrice + clampedDelta);
    const fundingRate = clampedDelta / indexPrice;
    return { markPrice, indexPrice, fundingRate, isClamped };
  }

  estimateComputeUnits(feedCount: number): number {
    const safeCount = Math.max(1, feedCount);
    return 3500 + (safeCount * 2500);
  }
}
