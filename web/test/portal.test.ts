import test from "node:test";
import assert from "node:assert/strict";
import { createInitialFeeds, createInitialRiskSignals } from "../app/mockData.ts";

test("Web Portal: Core-6 feeds are initialized with valid parameters", () => {
  const feeds = createInitialFeeds();
  assert.equal(feeds.length, 6);

  const symbols = feeds.map((f) => f.symbol);
  assert.deepEqual(symbols, [
    "BTC/USD",
    "ETH/USD",
    "SOL/USD",
    "USDC/USD",
    "USDT/USD",
    "DAI/USD",
  ]);

  for (const feed of feeds) {
    assert.ok(feed.price > 0, `Price must be positive for ${feed.symbol}`);
    assert.ok(feed.confidence > 0, `Confidence must be positive for ${feed.symbol}`);
    assert.ok(feed.confidence < feed.price, `Confidence must be smaller than price for ${feed.symbol}`);
    assert.ok(feed.priceQ64.startsWith("0x"), `priceQ64 must be hex for ${feed.symbol}`);
    assert.ok(feed.rawWireHex.startsWith("0x54485255"), `Raw wire must start with THRU magic for ${feed.symbol}`);
    assert.ok(feed.history.length >= 30, `History must contain at least 30 samples for ${feed.symbol}`);
  }
});

test("Web Portal: Stablecoin depeg signals are correctly classified", () => {
  const feeds = createInitialFeeds();
  const signals = createInitialRiskSignals(feeds);

  const usdcSignal = signals.find((s) => s.symbol === "USDC/USD");
  assert.ok(usdcSignal);
  assert.ok(usdcSignal.depegBps !== undefined);
  assert.ok(Math.abs(usdcSignal.depegBps) < 50, "USDC depeg should be within normal bounds");
  assert.equal(usdcSignal.status, "NORMAL");

  const solSignal = signals.find((s) => s.symbol === "SOL/USD");
  assert.ok(solSignal);
  assert.equal(solSignal.regime, "VOLATILE_EXPANSION");
  assert.ok(solSignal.volatility15mBps > 50, "SOL volatility should be high");
});
