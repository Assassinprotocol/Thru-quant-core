import type { DatabaseClient } from "@thru-quant/indexer";

export interface GatewayConfig {
  port?: number;
  host?: string;
  corsOrigin?: string | boolean;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  trustedProxies?: string[];
  db: DatabaseClient;
}

export interface FeedResponse {
  symbolId: number;
  symbol: string;
  price: number;
  priceRaw: string;
  confidenceBps: number;
  confidenceLowerBound: number;
  confidenceUpperBound: number;
  publishSlot: string;
  prevPublishSlot: string;
  medianSourceTs: string;
  ageSeconds: number;
  contributorCount: number;
  contributorMask: number;
  flags: number;
  isStale: boolean;
  isBigMove: boolean;
  isLowConfidence: boolean;
  hadOutlierRejected: boolean;
  provenance: {
    slot: string;
    accountAddress: string;
    magic: string;
  };
}

export interface RiskResponse {
  symbolId: number;
  symbol: string;
  slot: string;
  rollingVol30mBps: number;
  rollingVol1hBps: number;
  rollingVol24hBps: number;
  regime: string;
  regimeId: number;
  depegBps: number;
  updatedAt: string;
}

export interface ProvenanceResponse {
  slot: string;
  verified: boolean;
  symbolCount: number;
  feedMagic: string;
  programId: string;
  timestamp: string;
}
