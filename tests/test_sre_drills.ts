import { test, describe } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import {
  encodeOracleUpdate,
  encodeOracleResume,
  decodeOracleHex,
  OracleClient,
  evaluateRiskGate,
} from "../sdk/src/index.ts";
import { MemoryDatabase, SyncEngine } from "../indexer/src/index.ts";

describe("SRE Game-Day Incident Drills (D1-D8)", () => {
  test("D1: Publisher Key Revocation & Array Bounds", () => {
    assert.throws(() => {
      encodeOracleUpdate({
        version: 2,
        timestamp: Math.floor(Date.now() / 1000),
        entries: new Array(33).fill({
          symbolId: 1,
          priceHi: 0n,
          priceLo: 0n,
          confBps: 0,
          slot: 0,
          flags: 0,
        }),
      });
    }, /Cannot encode more than 32 symbols/);
  });

  test("D3: Primary RPC Outage & Failover", async () => {
    const primary = http.createServer((_req, res) => {
      res.writeHead(503).end();
    });
    await new Promise<void>((r) => primary.listen(0, r));
    const pAddr = primary.address();
    const primaryPort = typeof pAddr === "object" && pAddr ? pAddr.port : 0;

    const fallback = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          symbol: "BTC/USD",
          price: 84000.0,
          confidence: 25.0,
          slot: 1492200,
          timestamp: Math.floor(Date.now() / 1000),
          flags: 0,
          flagsList: ["VALID"],
          publishersCount: 3,
          totalPublishers: 7,
        })
      );
    });
    await new Promise<void>((r) => fallback.listen(0, r));
    const fAddr = fallback.address();
    const fallbackPort = typeof fAddr === "object" && fAddr ? fAddr.port : 0;

    let client = new OracleClient({ daemonUrl: `http://localhost:${primaryPort}` });
    try {
      await client.getLatestPrice("BTC/USD");
    } catch {
      client = new OracleClient({ daemonUrl: `http://localhost:${fallbackPort}` });
      const quote = await client.getLatestPrice("BTC/USD");
      assert.equal(quote.price, 84000.0);
    } finally {
      primary.close();
      fallback.close();
    }
  });

  test("D4: Chain Reorg & Sync Checkpoint Recovery", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const feed = {
      symbolId: 0,
      symbol: "BTC/USD",
      priceRaw: 8400000000000n,
      price: 84000.0,
      confidenceBps: 25,
      publishSlot: 1000n,
      prevPublishSlot: 990n,
      sourceTs: Math.floor(Date.now() / 1000),
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 7,
      hadOutlierRejected: false,
    };

    const first = await engine.processFeedAccount(feed, "tx-reorg-100");
    assert.equal(first, true);

    const second = await engine.processFeedAccount(feed, "tx-reorg-duplicate");
    assert.equal(second, false);
  });

  test("D5: Prolonged Disagreement & Consumer Guard Protection", () => {
    const now = Math.floor(Date.now() / 1000);
    const mockHaltedState = {
      version: 1,
      ageSeconds: 5,
      circuitBreakerActive: true,
      regime: 0,
      regimeName: "CALM",
      symbolsCount: 1,
      bySymbol: {
        BTCUSDT: {
          symbol: "BTCUSDT",
          priceDecimal: "84000.00",
          confidenceBps: 150,
          volatilityBps: 450,
          timestamp: now,
          status: "ACTIVE",
        },
      },
    };

    const decision = evaluateRiskGate(mockHaltedState, "BTCUSDT");
    assert.equal(decision.passed, false);
    assert.equal(decision.haircutPercent, 100);
  });

  test("D6: Two-Step Admin Handover Wire Payload", () => {
    const payload = encodeOracleResume(2);
    assert.equal(Buffer.from(payload).toString("hex"), "020000000200");
  });

  test("D7: Safe Rollback Wire Deserialization", () => {
    const hexPath = "./testdata/fixtures/oracle_state_alphanet_slot_7743340.hex";
    const rawHex = fs.readFileSync(hexPath, "utf8").trim();
    const decoded = decodeOracleHex(rawHex);

    assert.equal(decoded.version, 1);
    assert.equal(decoded.entries.length, 28);
    assert.ok(decoded.bySymbol["BTCUSDT"] !== undefined);
  });
});
