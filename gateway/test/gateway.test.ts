import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { MemoryDatabase, SyncEngine } from "@thru-quant/indexer";
import type { FeedAccountV2 } from "@thru-quant/core-sdk";
import { createGatewayServer } from "../src/server.ts";

describe("Gateway v2 API", () => {
  let app: FastifyInstance;
  let db: MemoryDatabase;
  let engine: SyncEngine;

  before(async () => {
    db = new MemoryDatabase();
    engine = new SyncEngine(db, "betanet");

    const feedBTC: FeedAccountV2 = {
      magic: 0x54464545,
      version: 2,
      symbolId: 1,
      status: 1,
      priceRaw: 8400000000000n,
      price: 84000.0,
      prevPriceRaw: 8390000000000n,
      confidenceBps: 25,
      publishSlot: 1050n,
      prevPublishSlot: 1000n,
      medianSourceTs: BigInt(Math.floor(Date.now() / 1000) - 5),
      contributorCount: 5,
      flags: 0,
      contributorMask: 0x1f,
      isStale: false,
      isBigMove: false,
      isLowConfidence: false,
      hadOutlierRejected: false,
    };
    await engine.processFeedAccount(feedBTC);
    await engine.updateCheckpoint(1050n);

    app = await createGatewayServer({ db });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("GET /v2/health returns operational liveness and synced slot", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/health" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.version, "2.0.0");
    assert.equal(body.syncedSlot, "1050");
  });

  test("GET /v2/feeds returns active feed array and headers", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/feeds" });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers["x-oracle-version"], "2");
    assert.equal(res.headers["x-oracle-slot"], "1050");

    const body = res.json();
    assert.equal(body.count, 1);
    const feed = body.data[0];
    assert.equal(feed.symbol, "BTC/USD");
    assert.equal(feed.price, 84000.0);
    assert.equal(feed.confidenceBps, 25);
    assert.ok(feed.confidenceLowerBound < 84000.0);
    assert.ok(feed.confidenceUpperBound > 84000.0);
  });

  test("GET /v2/feeds/:symbol supports case-insensitive and alias lookups", async () => {
    const res1 = await app.inject({ method: "GET", url: "/v2/feeds/BTC" });
    assert.equal(res1.statusCode, 200);
    assert.equal(res1.json().data.symbol, "BTC/USD");

    const res2 = await app.inject({ method: "GET", url: "/v2/feeds/btcusdt" });
    assert.equal(res2.statusCode, 200);
    assert.equal(res2.json().data.symbol, "BTC/USD");

    const res3 = await app.inject({ method: "GET", url: "/v2/feeds/0" });
    assert.equal(res3.statusCode, 200);
    assert.equal(res3.json().data.symbol, "BTC/USD");

    const resCanonical = await app.inject({ method: "GET", url: "/v2/feeds/1" });
    assert.equal(resCanonical.statusCode, 200);
    assert.equal(resCanonical.json().data.symbol, "BTC/USD");

    const resSlash = await app.inject({ method: "GET", url: "/v2/feeds/BTC/USD" });
    assert.equal(resSlash.statusCode, 200);
    assert.equal(resSlash.json().data.symbol, "BTC/USD");

    const resHyphen = await app.inject({ method: "GET", url: "/v2/feeds/BTC-USD" });
    assert.equal(resHyphen.statusCode, 200);
    assert.equal(resHyphen.json().data.symbol, "BTC/USD");

    const resHistory = await app.inject({ method: "GET", url: "/v2/feeds/BTC/USD/history" });
    assert.equal(resHistory.statusCode, 200);

    const res4 = await app.inject({ method: "GET", url: "/v2/feeds/UNKNOWN_COIN" });
    assert.equal(res4.statusCode, 404);
  });

  test("GET /v2/feeds supports strict mode enforcement", async () => {
    const feedStale: FeedAccountV2 = {
      magic: 0x54464545,
      version: 2,
      symbolId: 2,
      status: 1,
      priceRaw: 250000000000n,
      price: 2500.0,
      prevPriceRaw: 250000000000n,
      confidenceBps: 10,
      publishSlot: 800n,
      prevPublishSlot: 790n,
      medianSourceTs: BigInt(Math.floor(Date.now() / 1000) - 120),
      contributorCount: 5,
      flags: 1,
      contributorMask: 0x1f,
      isStale: true,
      isBigMove: false,
      isLowConfidence: false,
      hadOutlierRejected: false,
    };
    await engine.processFeedAccount(feedStale);

    const resStrict = await app.inject({
      method: "GET",
      url: "/v2/feeds?strict=true",
    });
    assert.equal(resStrict.statusCode, 412);
  });

  test("GET /v2/risk returns rolling volatility and regime markers", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/risk" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.ok(body.count >= 1);
    const btcRisk = body.data.find((r: any) => r.symbol === "BTC/USD");
    assert.ok(btcRisk !== undefined);
    assert.ok(btcRisk.regime === "CALM" || btcRisk.regime === "ELEVATED_VOL");
  });

  test("GET /v2/provenance/:slot returns verification audit", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/provenance/1050" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.data.verified, true);
    assert.equal(body.data.feedMagic, "0x54464545");
  });

  test("GET /v2/feeds/:symbol/stream initiates text/event-stream SSE", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/feeds/BTC/stream" });
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["content-type"]?.includes("text/event-stream"));
    assert.ok(res.body.includes("event: feed"));
  });

  test("GET /metrics returns Prometheus format gauges", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.includes("thru_oracle_v2_price{symbol=\"BTC_USD\"} 84000"));
    assert.ok(res.body.includes("thru_oracle_v2_confidence_bps{symbol=\"BTC_USD\"} 25"));
  });

  test("GET /v2/feeds/:symbol/twap calculates TWAP and range", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/feeds/BTC/twap" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.symbolId, 1);
    assert.equal(body.twap, 84000.0);
    assert.equal(body.samples, 1);
    assert.equal(body.minPrice, 84000.0);
    assert.equal(body.maxPrice, 84000.0);
    assert.equal(body.publishSlot, "1050");
  });

  test("GET /v2/feeds/:symbol/attestation exports 88-byte binary wire payload", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/feeds/BTC/attestation" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.symbolId, 1);
    assert.equal(body.wireSizeBytes, 88);
    assert.ok(typeof body.binaryWireHex === "string" && body.binaryWireHex.length === 176);
    assert.ok(body.binaryWireHex.startsWith("454546540200000001000000")); // TFEE, v2, id 1
    assert.ok(typeof body.sha256 === "string" && body.sha256.length === 64);
  });

  test("GET /v2/publishers returns operator quorum and participation metrics", async () => {
    const res = await app.inject({ method: "GET", url: "/v2/publishers" });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.tier, "T2");
    assert.equal(body.activeCount, 3);
    assert.ok(body.publishers.length >= 3);
    assert.equal(body.publishers[0].status, "ACTIVE");
  });
});
