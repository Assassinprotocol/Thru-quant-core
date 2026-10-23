import type { OracleFeed, RiskSignal } from "./types";

function toQ64Hex(val: number): string {
  const intPart = BigInt(Math.floor(val));
  const fracPart = BigInt(Math.round((val - Math.floor(val)) * 18446744073709551616));
  const full = (intPart << BigInt(64)) | fracPart;
  return "0x" + full.toString(16).padStart(32, "0");
}

function generateHistory(basePrice: number, volatility: number, count = 30): OracleFeed["history"] {
  const points: OracleFeed["history"] = [];
  const baseEpoch = 1729699200;
  let currentPrice = basePrice;
  const startSlot = 1492000;

  for (let i = count - 1; i >= 0; i--) {
    const wave = Math.sin(i * 0.4) * volatility * basePrice;
    currentPrice = Math.max(0.0001, basePrice + wave);
    const conf = currentPrice * 0.0006;
    points.push({
      slot: startSlot - i * 4,
      timestamp: baseEpoch - i * 16,
      price: Number(currentPrice.toFixed(basePrice < 2 ? 4 : 2)),
      confidence: Number(conf.toFixed(basePrice < 2 ? 6 : 4)),
    });
  }
  return points;
}

export function createInitialFeeds(): OracleFeed[] {
  const btcHistory = generateHistory(68420.5, 0.0012, 35);
  const ethHistory = generateHistory(3540.25, 0.0018, 35);
  const solHistory = generateHistory(182.4, 0.0025, 35);
  const usdcHistory = generateHistory(0.9998, 0.0001, 35);
  const usdtHistory = generateHistory(1.0003, 0.0001, 35);
  const daiHistory = generateHistory(0.9994, 0.0002, 35);

  const btcLast = btcHistory[btcHistory.length - 1];
  const ethLast = ethHistory[ethHistory.length - 1];
  const solLast = solHistory[solHistory.length - 1];
  const usdcLast = usdcHistory[usdcHistory.length - 1];
  const usdtLast = usdtHistory[usdtHistory.length - 1];
  const daiLast = daiHistory[daiHistory.length - 1];

  return [
    {
      symbol: "BTC/USD",
      base: "BTC",
      quote: "USD",
      price: btcLast.price,
      priceQ64: toQ64Hex(btcLast.price),
      confidence: btcLast.confidence,
      confidenceQ64: toQ64Hex(btcLast.confidence),
      confidenceBps: Math.round((btcLast.confidence / btcLast.price) * 10000),
      slot: btcLast.slot,
      timestamp: btcLast.timestamp,
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 0x3f,
      publishersCount: 6,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f0000000000010b4480000000000000000000000000000003f000000000000000",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: btcHistory,
    },
    {
      symbol: "ETH/USD",
      base: "ETH",
      quote: "USD",
      price: ethLast.price,
      priceQ64: toQ64Hex(ethLast.price),
      confidence: ethLast.confidence,
      confidenceQ64: toQ64Hex(ethLast.confidence),
      confidenceBps: Math.round((ethLast.confidence / ethLast.price) * 10000),
      slot: ethLast.slot,
      timestamp: ethLast.timestamp,
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 0x3f,
      publishersCount: 6,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f0000000000000dd440000000000000000000000000000003f000000000000000",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: ethHistory,
    },
    {
      symbol: "SOL/USD",
      base: "SOL",
      quote: "USD",
      price: solLast.price,
      priceQ64: toQ64Hex(solLast.price),
      confidence: solLast.confidence,
      confidenceQ64: toQ64Hex(solLast.confidence),
      confidenceBps: Math.round((solLast.confidence / solLast.price) * 10000),
      slot: solLast.slot,
      timestamp: solLast.timestamp,
      flags: 1,
      flagsList: ["VALID", "BIG_MOVE"],
      publisherMask: 0x1f,
      publishersCount: 5,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f00000000000000b666000000000000000000000000000001f000000000000001",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: solHistory,
    },
    {
      symbol: "USDC/USD",
      base: "USDC",
      quote: "USD",
      price: usdcLast.price,
      priceQ64: toQ64Hex(usdcLast.price),
      confidence: usdcLast.confidence,
      confidenceQ64: toQ64Hex(usdcLast.confidence),
      confidenceBps: Math.round((usdcLast.confidence / usdcLast.price) * 10000),
      slot: usdcLast.slot,
      timestamp: usdcLast.timestamp,
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 0x7f,
      publishersCount: 7,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f0000000000000000fffa0000000000000000000000000007f000000000000000",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: usdcHistory,
    },
    {
      symbol: "USDT/USD",
      base: "USDT",
      quote: "USD",
      price: usdtLast.price,
      priceQ64: toQ64Hex(usdtLast.price),
      confidence: usdtLast.confidence,
      confidenceQ64: toQ64Hex(usdtLast.confidence),
      confidenceBps: Math.round((usdtLast.confidence / usdtLast.price) * 10000),
      slot: usdtLast.slot,
      timestamp: usdtLast.timestamp,
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 0x7f,
      publishersCount: 7,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f000000000000000100080000000000000000000000000007f000000000000000",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: usdtHistory,
    },
    {
      symbol: "DAI/USD",
      base: "DAI",
      quote: "USD",
      price: daiLast.price,
      priceQ64: toQ64Hex(daiLast.price),
      confidence: daiLast.confidence,
      confidenceQ64: toQ64Hex(daiLast.confidence),
      confidenceBps: Math.round((daiLast.confidence / daiLast.price) * 10000),
      slot: daiLast.slot,
      timestamp: daiLast.timestamp,
      flags: 0,
      flagsList: ["VALID"],
      publisherMask: 0x3f,
      publishersCount: 6,
      totalPublishers: 7,
      rawWireHex: "0x54485255020000000016c4f0667b2d5f0000000000000000fff00000000000000000000000000003f000000000000000",
      authority: "taWLm...bdfR",
      programId: "taQbv...3FvwPN",
      history: daiHistory,
    },
  ];
}

export function createInitialRiskSignals(feeds: OracleFeed[]): RiskSignal[] {
  return feeds.map((f) => {
    const isStable = ["USDC/USD", "USDT/USD", "DAI/USD"].includes(f.symbol);
    const depegBps = isStable ? Math.round((f.price - 1.0) * 10000) : undefined;
    const depegRatio = isStable ? f.price / 1.0 : undefined;

    let regime: RiskSignal["regime"] = "NEUTRAL";
    if (f.symbol === "SOL/USD") regime = "VOLATILE_EXPANSION";
    else if (f.symbol === "BTC/USD") regime = "TRENDING_UP";
    else if (isStable) regime = "COMPRESSION";

    let status: RiskSignal["status"] = "NORMAL";
    if (depegBps !== undefined && Math.abs(depegBps) > 50) status = "WARNING";

    return {
      symbol: f.symbol,
      volatility15mBps: isStable ? 2 : f.symbol === "BTC/USD" ? 48 : f.symbol === "ETH/USD" ? 64 : 112,
      volatility1hBps: isStable ? 4 : f.symbol === "BTC/USD" ? 85 : f.symbol === "ETH/USD" ? 104 : 178,
      regime,
      depegRatio,
      depegBps,
      status,
    };
  });
}
