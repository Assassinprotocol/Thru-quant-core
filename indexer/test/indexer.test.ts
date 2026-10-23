import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { MemoryDatabase } from "../src/db.ts";
import { SyncEngine } from "../src/sync.ts";
import {
  calculateRollingVolBps,
  calculateDepegBps,
  classifyMarketRegime,
  REGIME_CALM,
  REGIME_ELEVATED_VOL,
  REGIME_EXTREME_DISPERSION,
} from "../src/risk.ts";
import type { FeedAccountV2, AggregateUpdatedEvent } from "@thru-quant/core-sdk";

describe("Indexer Risk Engine", () => {
  test("flat prices yield zero volatility", () => {
    const prices = [100, 100, 100, 100, 100];
    const vol = calculateRollingVolBps(prices);
    assert.equal(vol, 0);
  });

  test("calculates rolling volatility for volatile series", () => {
    const prices = [100, 102, 98, 103, 97];
    const vol = calculateRollingVolBps(prices);
    assert.ok(vol > 200, `Expected vol > 200 bps, got ${vol}`);
  });

  test("calculates stablecoin depeg only for USD pairs", () => {
    assert.equal(calculateDepegBps("USDT/USD", 0.985), 150);
    assert.equal(calculateDepegBps("USDC/USD", 1.0005), 5);
    assert.equal(calculateDepegBps("BTC/USD", 84000), 0);
  });

  test("classifies market regimes according to volatility and flags", () => {
    assert.equal(classifyMarketRegime(50, false, false), REGIME_CALM);
    assert.equal(classifyMarketRegime(250, false, false), REGIME_ELEVATED_VOL);
    assert.equal(classifyMarketRegime(600, false, false), REGIME_EXTREME_DISPERSION);
    assert.equal(classifyMarketRegime(50, true, false), REGIME_EXTREME_DISPERSION);
    assert.equal(classifyMarketRegime(50, false, true), REGIME_EXTREME_DISPERSION);
  });
});

describe("Indexer Sync Engine & State Storage", () => {
  test("processes FeedAccountV2 and maintains snapshots", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const feed: FeedAccountV2 = {
      magic: 0x54464545,
      version: 2,
      symbolId: 0,
      status: 1,
      priceRaw: 8400000000000n,
      price: 84000.0,
      prevPriceRaw: 8395000000000n,
      confidenceBps: 20,
      publishSlot: 1000n,
      prevPublishSlot: 990n,
      medianSourceTs: 1700000000n,
      contributorCount: 5,
      flags: 0,
      contributorMask: 0x1f,
      isStale: false,
      isBigMove: false,
      isLowConfidence: false,
      hadOutlierRejected: false,
    };

    const inserted = await engine.processFeedAccount(feed, "tx-hash-001");
    assert.equal(inserted, true);

    const snapshot = await db.getSnapshot(0);
    assert.ok(snapshot !== null);
    assert.equal(snapshot?.symbol, "BTC/USD");
    assert.equal(snapshot?.price, 84000.0);
    assert.equal(snapshot?.publishSlot, 1000n);

    const reinserted = await engine.processFeedAccount(feed, "tx-hash-dup");
    assert.equal(reinserted, false);

    const feed2: FeedAccountV2 = {
      ...feed,
      publishSlot: 1010n,
      prevPublishSlot: 1000n,
      priceRaw: 8420000000000n,
      price: 84200.0,
    };
    await engine.processFeedAccount(feed2, "tx-hash-002");

    const updatedSnapshot = await db.getSnapshot(0);
    assert.equal(updatedSnapshot?.publishSlot, 1010n);
    assert.equal(updatedSnapshot?.price, 84200.0);

    const risk = await db.getLatestRiskSignal(0);
    assert.ok(risk !== null);
    assert.equal(risk?.symbol, "BTC/USD");
  });

  test("processes AggregateUpdatedEvent and updates state", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const event: AggregateUpdatedEvent = {
      eventType: 1,
      symbolId: 2,
      flags: 2,
      contributorMask: 0x07,
      priceRaw: 10550000000n,
      price: 105.5,
      confidenceBps: 15,
      publishSlot: 2000n,
      medianSourceTs: 1700000050n,
    };

    const inserted = await engine.processAggregateEvent(event, "tx-ev-001");
    assert.equal(inserted, true);

    const snapshot = await db.getSnapshot(2);
    assert.ok(snapshot !== null);
    assert.equal(snapshot?.symbol, "SOL/USD");
    assert.equal(snapshot?.price, 105.5);
    assert.equal(snapshot?.contributorCount, 3);
  });

  test("persists and recovers sync checkpoint", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const initCp = await engine.getCheckpoint();
    assert.equal(initCp, null);

    await engine.updateCheckpoint(2500000n, "0xabcdef123456");
    const cp = await engine.getCheckpoint();
    assert.ok(cp !== null);
    assert.equal(cp?.lastProcessedSlot, 2500000n);
    assert.equal(cp?.lastProcessedBlockHash, "0xabcdef123456");
  });

  test("reconstructs full database state from raw event replay", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const events: AggregateUpdatedEvent[] = Array.from({ length: 10 }, (_, i) => ({
      eventType: 1,
      symbolId: 1,
      flags: 0,
      contributorMask: 0x0f,
      priceRaw: BigInt(250000000000 + i * 100000000),
      price: 2500.0 + i,
      confidenceBps: 10,
      publishSlot: BigInt(1000 + i * 10),
      medianSourceTs: BigInt(1700000000 + i * 60),
    }));

    for (const ev of events) {
      const ok = await engine.processAggregateEvent(ev);
      assert.equal(ok, true);
    }

    const snapshot = await db.getSnapshot(1);
    assert.ok(snapshot !== null);
    assert.equal(snapshot?.publishSlot, 1090n);
    assert.equal(snapshot?.price, 2509.0);

    const snapshots = await db.listSnapshots();
    assert.equal(snapshots.length, 1);
  });

  test("resumes from checkpoint without duplicate insertions on replay", async () => {
    const db = new MemoryDatabase();
    const engine = new SyncEngine(db, "betanet");

    const batch: AggregateUpdatedEvent[] = [
      {
        eventType: 1,
        symbolId: 0,
        flags: 0,
        contributorMask: 0x1f,
        priceRaw: 8400000000000n,
        price: 84000.0,
        confidenceBps: 20,
        publishSlot: 5000n,
        medianSourceTs: 1700000000n,
      },
      {
        eventType: 1,
        symbolId: 0,
        flags: 0,
        contributorMask: 0x1f,
        priceRaw: 8410000000000n,
        price: 84100.0,
        confidenceBps: 20,
        publishSlot: 5010n,
        medianSourceTs: 1700000060n,
      },
    ];

    for (const ev of batch) {
      await engine.processAggregateEvent(ev);
    }
    await engine.updateCheckpoint(5010n);

    const cp = await engine.getCheckpoint();
    assert.equal(cp?.lastProcessedSlot, 5010n);

    for (const ev of batch) {
      if (ev.publishSlot <= (cp?.lastProcessedSlot || 0n)) {
        const reinserted = await engine.processAggregateEvent(ev);
        assert.equal(reinserted, false);
      }
    }

    const nextEv: AggregateUpdatedEvent = {
      eventType: 1,
      symbolId: 0,
      flags: 0,
      contributorMask: 0x1f,
      priceRaw: 8420000000000n,
      price: 84200.0,
      confidenceBps: 20,
      publishSlot: 5020n,
      medianSourceTs: 1700000120n,
    };
    const nextInserted = await engine.processAggregateEvent(nextEv);
    assert.equal(nextInserted, true);
    await engine.updateCheckpoint(5020n);

    const updatedCp = await engine.getCheckpoint();
    assert.equal(updatedCp?.lastProcessedSlot, 5020n);
  });
});
