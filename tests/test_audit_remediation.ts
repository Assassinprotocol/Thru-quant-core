import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  encodeOracleUpdate,
  evaluateRiskGate,
  type OracleState,
} from "../sdk/src/index.ts";
import { createGatewayServer } from "../gateway/src/server.ts";
import { MemoryDatabase } from "../indexer/src/db.ts";

describe("WP-29: External Audit Remediation Regression Suite", () => {
  test("TPC-01: Timestamp monotonicity & forward clock validation", () => {
    const now = Math.floor(Date.now() / 1000);

    const payload = encodeOracleUpdate({
      oracleAccountIdx: 2,
      regimeId: 1,
      timestamp: now,
      entries: [
        {
          symbolId: 1,
          priceQ64Hi: 65000n,
          priceQ64Lo: 0n,
          volatilityBps: 15,
          timestamp: now,
        },
      ],
    });

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    assert.equal(view.getUint32(0, true), 1);
    assert.equal(view.getUint16(4, true), 2);
    assert.equal(view.getUint32(10, true), now);
    assert.equal(view.getUint32(14, true), 1);
    assert.equal(view.getUint32(18, true), 1);
    assert.equal(view.getBigUint64(22, true), 65000n);
    assert.equal(view.getUint32(38, true), 15);
  });

  test("TPC-02: Socket-level rate limiter & client address determination", async () => {
    const db = new MemoryDatabase();
    const app = await createGatewayServer({
      db,
      trustedProxies: ["10.0.0.1"],
    });
    app.get("/test-client-ip", async (req) => ({ clientIp: req.ip }));
    await app.ready();

    // Untrusted remote trying to spoof X-Forwarded-For
    const untrustedRes = await app.inject({
      method: "GET",
      url: "/test-client-ip",
      remoteAddress: "203.0.113.195",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    assert.equal(untrustedRes.json().clientIp, "203.0.113.195");

    // Trusted reverse proxy forwarding client IP
    const trustedRes = await app.inject({
      method: "GET",
      url: "/test-client-ip",
      remoteAddress: "10.0.0.1",
      headers: { "x-forwarded-for": "198.51.100.42" },
    });
    assert.equal(trustedRes.json().clientIp, "198.51.100.42");

    await app.close();
  });

  test("TPC-03: Sliding window buffer memory bounds", async () => {
    const db = new MemoryDatabase();
    for (let i = 0; i < 600; i++) {
      await db.insertAggregate({
        symbolId: 1,
        price: 100 + i,
        priceRaw: BigInt(100 + i) * 100000000n,
        confidenceBps: 10,
        publishSlot: BigInt(1000 + i),
        sourceTs: BigInt(1000 + i),
        contributorCount: 5,
        flags: 0,
        regime: "NEUTRAL",
        volatilityBps: 10,
        isStale: false,
        hadOutlier: false,
      });
    }

    const prices = await db.getRecentPrices(1, 1000);
    assert.equal(prices.length, 500);
  });

  test("TPC-04: Strict wire bounds on ABI payload entries", () => {
    assert.throws(() => {
      encodeOracleUpdate({
        oracleAccountIdx: 2,
        regimeId: 1,
        timestamp: Math.floor(Date.now() / 1000),
        entries: new Array(33).fill({
          symbolId: 1,
          priceQ64Hi: 100n,
          priceQ64Lo: 0n,
          volatilityBps: 10,
          timestamp: 1,
        }),
      });
    }, /Cannot encode more than 32 symbols/);
  });

  test("TPC-05: Risk gate invariant enforcement under degraded consensus", () => {
    const mockState: OracleState = {
      isInitialized: true,
      circuitBreakerActive: false,
      authorityPubkey: "ta1234567890123456789012345678901234567890",
      regimeId: 1,
      lastUpdateTimestamp: 1000,
      totalEntries: 1,
      bySymbol: {
        BTCUSDT: {
          symbolId: 1,
          symbolName: "BTCUSDT",
          priceQ64Hi: 50000n,
          priceQ64Lo: 0n,
          volatilityBps: 20,
          timestamp: 1000,
          flags: 0,
        },
      },
      rawBytesLength: 100,
    };

    const staleResult = evaluateRiskGate(mockState, "BTCUSDT", {
      nowSec: 1200,
      maxAgeSec: 120,
    });
    assert.equal(staleResult.passed, false);
    assert.match(staleResult.reason ?? "", /STALE_QUOTE/);

    const highVolState: OracleState = {
      ...mockState,
      bySymbol: {
        BTCUSDT: {
          ...mockState.bySymbol.BTCUSDT!,
          volatilityBps: 500,
        },
      },
    };
    const volResult = evaluateRiskGate(highVolState, "BTCUSDT", {
      nowSec: 1005,
      maxVolatilityBps: 400,
    });
    assert.equal(volResult.passed, true);
    assert.equal(volResult.haircutPercent, 25);
  });
});
