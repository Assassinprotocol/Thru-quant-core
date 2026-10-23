export interface FeedHistoryPoint {
  slot: number;
  timestamp: number;
  price: number;
  confidence: number;
}

export interface OracleFeed {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  priceQ64: string;
  confidence: number;
  confidenceQ64: string;
  confidenceBps: number;
  slot: number;
  timestamp: number;
  flags: number;
  flagsList: string[];
  publisherMask: number;
  publishersCount: number;
  totalPublishers: number;
  rawWireHex: string;
  authority: string;
  programId: string;
  history: FeedHistoryPoint[];
}

export interface RiskSignal {
  symbol: string;
  volatility15mBps: number;
  volatility1hBps: number;
  regime: "NEUTRAL" | "TRENDING_UP" | "TRENDING_DOWN" | "VOLATILE_EXPANSION" | "COMPRESSION";
  depegRatio?: number;
  depegBps?: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

export interface TelemetryStatus {
  connected: boolean;
  mode: "SSE" | "POLLING" | "SIMULATED";
  slot: number;
  lastUpdateTs: number;
  circuitBreakerActive: boolean;
  p99LatencyUs: number;
  gatewayUrl: string;
}
