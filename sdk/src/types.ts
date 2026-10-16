/**
 * @file types.ts
 * @description Canonical type definitions for Thru Quant Core Oracle wire protocol and client.
 */

export const ORACLE_ACCOUNT_EXPECTED_SIZE = 948;
export const ORACLE_HEADER_SIZE = 52;
export const ORACLE_ENTRY_SIZE = 28;
export const MAX_ORACLE_SYMBOLS = 32;

export const MAX_ALLOWED_DEVIATION_BPS = 500; // 5% max deviation per single update
export const MAX_QUOTE_AGE_SECONDS = 120;     // 2 minutes staleness threshold
export const MAX_FUTURE_SKEW_SECONDS = 30;    // 30 seconds future skew bound

/**
 * On-chain instruction types
 */
export const OracleInstruction = {
  INITIALIZE: 0,
  UPDATE_PRICES: 1,
  RESUME: 2,
} as const;
export type OracleInstruction =
  (typeof OracleInstruction)[keyof typeof OracleInstruction];

/**
 * Contract status and error codes (0x2001 - 0x200C)
 */
export const OracleErrorCode = {
  INVALID_INSTR_SIZE: 0x2001,
  INVALID_INSTR_TYPE: 0x2002,
  UNAUTHORIZED: 0x2003,
  DATA_ACCESS_FAILED: 0x2004,
  ACCOUNT_INIT_FAILED: 0x2005,
  INVALID_COUNT: 0x2006,
  CIRCUIT_BREAKER: 0x2007,
  ALREADY_INITIALIZED: 0x2008,
  STALE_TIMESTAMP: 0x2009,
  FUTURE_SKEW: 0x200a,
  DUPLICATE_SYMBOL: 0x200b,
  INVALID_PRICE: 0x200c,
} as const;
export type OracleErrorCode =
  (typeof OracleErrorCode)[keyof typeof OracleErrorCode];

/**
 * Human-readable mapping of market regimes
 */
export const RegimeNames: Record<number, string> = {
  0: "NEUTRAL_SIDEWAYS",
  1: "TRENDING_UP",
  2: "TRENDING_DOWN",
  3: "HIGH_VOLATILITY",
};

/**
 * Canonical 32-asset registry matching on-chain and Go feeder IDs
 */
export const KnownSymbolMap: Record<number, string> = {
  1: "BTCUSDT",
  2: "ETHUSDT",
  3: "SOLUSDT",
  4: "APTUSDT",
  5: "SUIUSDT",
  6: "BNBUSDT",
  7: "DOGEUSDT",
  8: "XRPUSDT",
  9: "AVAXUSDT",
  10: "LINKUSDT",
  11: "NEARUSDT",
  12: "ARBUSDT",
  13: "OPUSDT",
  14: "TIAUSDT",
  15: "INJUSDT",
  16: "SEIUSDT",
  17: "SUSDT",
  18: "UNIUSDT",
  19: "AAVEUSDT",
  20: "TAOUSDT",
  21: "PEPEUSDT",
  22: "SHIBUSDT",
  23: "WIFUSDT",
  24: "BONKUSDT",
  25: "RENDERUSDT",
  26: "FETUSDT",
  27: "FTMUSDT",
  28: "KASUSDT",
  29: "STXUSDT",
  30: "FILUSDT",
  31: "LTCUSDT",
  32: "BCHUSDT",
};

export const ReverseSymbolMap: Record<string, number> = Object.entries(
  KnownSymbolMap
).reduce((acc, [id, sym]) => {
  acc[sym] = Number(id);
  return acc;
}, {} as Record<string, number>);

/**
 * Single market asset quote unpacked from binary wire
 */
export interface OracleEntry {
  symbolId: number;
  symbol: string;
  priceQ64Hi: bigint;
  priceQ64Lo: bigint;
  price: number;              // Float approximation (IEEE-754)
  priceDecimal: string;       // Exact BigInt decimal string representation
  volatilityBps: number;      // Volatility in Basis Points (100 = 1%)
  timestamp: number;          // Unix timestamp in seconds
  ageSec: number;             // Age relative to decoding time
}

/**
 * Deserialized state of the on-chain Oracle storage account
 */
export interface OracleState {
  version: number;
  authorityPubkey: string;    // Hex-encoded 32-byte pubkey
  circuitBreakerActive: boolean;
  regimeId: number;
  regimeName: string;
  lastUpdateTs: number;
  feedAgeSec: number;
  entryCount: number;
  entries: OracleEntry[];
  bySymbol: Record<string, OracleEntry>; // O(1) indexed lookup by ticker
  byId: Record<number, OracleEntry>;     // O(1) indexed lookup by ID
  sourceMode?: string;
}

/**
 * Arguments for constructing an Oracle Price Update transaction payload
 */
export interface OracleUpdateArgs {
  oracleAccountIdx: number;
  regimeId: number;
  timestamp: number;
  entries: {
    symbolId: number;
    priceQ64Hi: bigint;
    priceQ64Lo: bigint;
    volatilityBps: number;
    timestamp: number;
  }[];
}

/**
 * Risk evaluation thresholds and results
 */
export interface RiskGateOptions {
  maxAgeSec?: number;
  maxVolatilityBps?: number;
  nowSec?: number;
}

export interface RiskEvaluationResult {
  passed: boolean;
  reason?: string;
  haircutPercent: number;    // Additional margin haircut recommended (e.g. 0% or 25%)
  quote?: OracleEntry;
}

/**
 * Client configuration options
 */
export interface OracleClientOptions {
  rpcUrl?: string;            // Direct Thru JSON-RPC endpoint
  daemonUrl?: string;         // Local Go Daemon REST endpoint (default http://localhost:8082)
  accountAddress?: string;    // Oracle Account Address (taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN)
  timeoutMs?: number;
}
