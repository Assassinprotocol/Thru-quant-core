/**
 * @file types.ts
 * @description Canonical type definitions for Thru Quant Core Oracle wire protocol and client.
 */
export const ORACLE_ACCOUNT_EXPECTED_SIZE = 948;
export const ORACLE_HEADER_SIZE = 52;
export const ORACLE_ENTRY_SIZE = 28;
export const MAX_ORACLE_SYMBOLS = 32;
export const MAX_ALLOWED_DEVIATION_BPS = 500; // 5% max deviation per single update
export const MAX_QUOTE_AGE_SECONDS = 120; // 2 minutes staleness threshold
export const MAX_FUTURE_SKEW_SECONDS = 30; // 30 seconds future skew bound
/**
 * On-chain instruction types
 */
export const OracleInstruction = {
    INITIALIZE: 0,
    UPDATE_PRICES: 1,
    RESUME: 2,
};
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
};
/**
 * Human-readable mapping of market regimes
 */
export const RegimeNames = {
    0: "NEUTRAL_SIDEWAYS",
    1: "TRENDING_UP",
    2: "TRENDING_DOWN",
    3: "HIGH_VOLATILITY",
};
/**
 * Canonical 32-asset registry matching on-chain and Go feeder IDs
 */
export const KnownSymbolMap = {
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
export const ReverseSymbolMap = Object.entries(KnownSymbolMap).reduce((acc, [id, sym]) => {
    acc[sym] = Number(id);
    return acc;
}, {});
//# sourceMappingURL=types.js.map