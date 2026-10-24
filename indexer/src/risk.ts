import type { RiskSignalRecord } from "./types.ts";

export const REGIME_CALM = 0;
export const REGIME_ELEVATED_VOL = 1;
export const REGIME_EXTREME_DISPERSION = 2;

export function calculateRollingVolBps(prices: number[]): number {
  if (prices.length < 2) {
    return 0;
  }

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev <= 0) continue;
    returns.push((prices[i] - prev) / prev);
  }

  if (returns.length < 1) {
    return 0;
  }

  const mean = returns.reduce((acc, r) => acc + r, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) /
    (returns.length > 1 ? returns.length - 1 : 1);

  const stdDev = Math.sqrt(variance);
  return Math.min(100000, Math.max(0, Math.round(stdDev * 10000)));
}

export function calculateDepegBps(symbol: string, price: number): number {
  const upper = symbol.toUpperCase();
  if (
    !upper.startsWith("USDT") &&
    !upper.startsWith("USDC") &&
    !upper.startsWith("DAI") &&
    !upper.startsWith("USD/")
  ) {
    return 0;
  }
  const deviation = Math.abs(price - 1.0);
  return Math.round(deviation * 10000);
}

export function classifyMarketRegime(
  rollingVol1hBps: number,
  isLowConfidence: boolean,
  hadOutlierRejected: boolean
): number {
  if (rollingVol1hBps >= 500 || isLowConfidence || hadOutlierRejected) {
    return REGIME_EXTREME_DISPERSION;
  }
  if (rollingVol1hBps >= 150) {
    return REGIME_ELEVATED_VOL;
  }
  return REGIME_CALM;
}

export function evaluateRiskSignals(
  symbolId: number,
  symbol: string,
  slot: bigint,
  recentPrices: number[],
  isLowConfidence: boolean,
  hadOutlierRejected: boolean
): RiskSignalRecord {
  const count = recentPrices.length;
  const p30m = recentPrices.slice(Math.max(0, count - 10));
  const p1h = recentPrices.slice(Math.max(0, count - 20));
  const p24h = recentPrices;

  const vol30m = calculateRollingVolBps(p30m);
  const vol1h = calculateRollingVolBps(p1h);
  const vol24h = calculateRollingVolBps(p24h);

  const currentPrice = count > 0 ? recentPrices[count - 1] : 0;
  const depeg = calculateDepegBps(symbol, currentPrice);
  const regime = classifyMarketRegime(vol1h, isLowConfidence, hadOutlierRejected);

  return {
    symbolId,
    symbol,
    slot,
    rollingVol30mBps: vol30m,
    rollingVol1hBps: vol1h,
    rollingVol24hBps: vol24h,
    regimeId: regime,
    depegBps: depeg,
  };
}

export interface TwapResult {
  twap: number;
  samples: number;
  minPrice: number;
  maxPrice: number;
}

export function calculateTwap(prices: number[]): TwapResult {
  if (prices.length === 0) {
    return { twap: 0, samples: 0, minPrice: 0, maxPrice: 0 };
  }
  const sum = prices.reduce((acc, p) => acc + p, 0);
  const avg = sum / prices.length;
  let decimals = 2;
  if (avg > 0 && avg < 2) {
    decimals = Math.min(8, Math.max(6, -Math.floor(Math.log10(avg)) + 2));
  }
  let minPrice = prices[0];
  let maxPrice = prices[0];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] < minPrice) minPrice = prices[i];
    if (prices[i] > maxPrice) maxPrice = prices[i];
  }
  return {
    twap: Number(avg.toFixed(decimals)),
    samples: prices.length,
    minPrice,
    maxPrice,
  };
}
