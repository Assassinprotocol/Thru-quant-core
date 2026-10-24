import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { MemoryDatabase, SyncEngine } from "@thru-quant/indexer";
import type { FeedAccountV2 } from "@thru-quant/core-sdk";
import { createGatewayServer } from "../src/server.ts";

describe("Gateway v2 High-Throughput Load Benchmark", () => {
  let app: FastifyInstance;
  let db: MemoryDatabase;
  let engine: SyncEngine;

  before(async () => {
    db = new MemoryDatabase();
    engine = new SyncEngine(db, "betanet");

    const feed: FeedAccountV2 = {
      magic: 0x54464545,
      version: 2,
      symbolId: 1,
      status: 1,
      priceRaw: 8400000000000n,
      price: 84000.0,
      prevPriceRaw: 8390000000000n,
      confidenceBps: 20,
      publishSlot: 1000n,
      prevPublishSlot: 990n,
      medianSourceTs: BigInt(Math.floor(Date.now() / 1000) - 2),
      contributorCount: 5,
      flags: 0,
      contributorMask: 0x1f,
      isStale: false,
      isBigMove: false,
      isLowConfidence: false,
      hadOutlierRejected: false,
    };
    await engine.processFeedAccount(feed);

    app = await createGatewayServer({
      db,
      rateLimitMax: 100000,
    });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test("sustains 5,000 requests with sub-millisecond median latency", async () => {
    const totalRequests = 5000;
    const concurrency = 20;
    const start = performance.now();

    for (let i = 0; i < totalRequests; i += concurrency) {
      const batch = Array.from({ length: Math.min(concurrency, totalRequests - i) }, () =>
        app.inject({
          method: "GET",
          url: "/v2/feeds/BTC",
        })
      );
      const responses = await Promise.all(batch);
      for (const res of responses) {
        assert.equal(res.statusCode, 200);
      }
    }

    const durationMs = performance.now() - start;
    const reqPerSec = Math.round((totalRequests / durationMs) * 1000);
    const avgLatencyMs = (durationMs / totalRequests).toFixed(3);

    assert.ok(reqPerSec > 1000, `Expected > 1,000 req/s, got ${reqPerSec}`);
    assert.ok(parseFloat(avgLatencyMs) < 1.0, `Expected < 1.0ms latency, got ${avgLatencyMs}ms`);
  });
});
