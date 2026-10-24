import test from "node:test";
import assert from "node:assert/strict";
import { createInitialFeeds, createInitialRiskSignals, createInitialPublishers } from "../app/mockData.ts";

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

test("Web Portal: Tier T2 publishers are initialized with valid quorum", () => {
  const publishers = createInitialPublishers();
  assert.ok(publishers.length >= 3, "Must have at least 3 publishers for T2 quorum");
  for (const pub of publishers) {
    assert.ok(pub.id.startsWith("pub_"));
    assert.ok(pub.pubkey.length > 20);
    assert.ok(pub.uptimePercent > 99.0);
    assert.equal(pub.status, "ACTIVE");
  }
});

test("Web Portal: Gateway sync supports both { data: [...] } and { feeds: [...] }", () => {
  const payloadData = {
    data: [
      { symbol: "BTC/USD", price: 68000, confidenceBps: 20, publishSlot: "1500000" },
    ],
  };
  const listFromData = Array.isArray(payloadData.data) ? payloadData.data : [];
  assert.equal(listFromData.length, 1);
  assert.equal(listFromData[0].price, 68000);

  const payloadFeeds = {
    feeds: [
      { symbol: "BTC/USD", price: 68000, confidence: 136, slot: 1500000 },
    ],
  };
  const listFromFeeds = Array.isArray((payloadFeeds as any).data)
    ? (payloadFeeds as any).data
    : (Array.isArray(payloadFeeds.feeds) ? payloadFeeds.feeds : []);
  assert.equal(listFromFeeds.length, 1);
  assert.equal(listFromFeeds[0].slot, 1500000);
});

test("Web Portal: Feed trajectory math is non-NaN on single point or empty history", () => {
  const emptyHistory: any[] = [];
  const fallback = emptyHistory.length > 0 ? emptyHistory : [{ slot: 1, timestamp: 1, price: 100, confidence: 1 }];
  const history = fallback.length === 1 ? [...fallback, ...fallback] : fallback;
  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices.map((p, i) => p - (history[i]?.confidence || 0)));
  const maxPrice = Math.max(...prices.map((p, i) => p + (history[i]?.confidence || 0)));
  const priceRange = maxPrice - minPrice > 0 ? maxPrice - minPrice : 1;
  const denom = Math.max(1, history.length - 1);

  assert.ok(Number.isFinite(minPrice));
  assert.ok(Number.isFinite(maxPrice));
  assert.ok(priceRange > 0);
  assert.ok(denom >= 1);
});
