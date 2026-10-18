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
    REBASE: 3,
};
/**
 * Contract status and error codes (0x2001 - 0x2013)
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
    CLOCK_UNAVAILABLE: 0x200d,
    ENTRY_TIMESTAMP: 0x200e,
    SYMBOL_CAPACITY: 0x200f,
    INVALID_SYMBOL: 0x2010,
    NOT_TRIPPED: 0x2011,
    INVALID_REGIME: 0x2012,
    RESIZE_FAILED: 0x2013,
    INVALID_VOLATILITY: 0x2014,
};
/**
 * Descriptive human-readable explanations for Oracle contract errors
 */
export const OracleErrorMessages = {
    0x2001: "Instruction size does not match expected header or entry payload",
    0x2002: "Invalid or unsupported instruction opcode",
    0x2003: "Unauthorized: caller fee payer is not bound authority",
    0x2004: "Data access failed: account index invalid, missing, or size mismatch",
    0x2005: "Account initialization failed during system create",
    0x2006: "Invalid entry count (must be between 1 and 32)",
    0x2007: "Circuit breaker tripped: price deviation exceeded limit",
    0x2008: "Account already initialized: double initialization rejected",
    0x2009: "Header timestamp is stale compared to stored state or block time",
    0x200a: "Header timestamp is too far in future (> 30s skew)",
    0x200b: "Duplicate symbol ID found in incoming quote batch",
    0x200c: "Invalid quote price: zero price or MSB sign bit set",
    0x200d: "Clock unavailable: block context is NULL or block_time is zero",
    0x200e: "Entry timestamp invalid: future to header, older than stored, or regressive",
    0x200f: "Symbol capacity exceeded (> 32 unique symbols)",
    0x2010: "Invalid symbol ID: symbol ID must be greater than zero",
    0x2011: "Circuit breaker is not tripped: cannot resume untripped oracle",
    0x2012: "Invalid market regime ID: must be between 0 and 3",
    0x2013: "Account resize failed during initialization",
    0x2014: "Invalid volatility: value exceeds 10000 bps (100%) and is not unknown sentinel",
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