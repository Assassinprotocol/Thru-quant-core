/**
 * @file types.ts
 * @description Canonical type definitions for Thru Quant Core Oracle wire protocol and client.
 */
export declare const ORACLE_ACCOUNT_EXPECTED_SIZE = 948;
export declare const ORACLE_HEADER_SIZE = 52;
export declare const ORACLE_ENTRY_SIZE = 28;
export declare const MAX_ORACLE_SYMBOLS = 32;
export declare const MAX_ALLOWED_DEVIATION_BPS = 500;
export declare const MAX_QUOTE_AGE_SECONDS = 120;
export declare const MAX_FUTURE_SKEW_SECONDS = 30;
/**
 * On-chain instruction types
 */
export declare const OracleInstruction: {
    readonly INITIALIZE: 0;
    readonly UPDATE_PRICES: 1;
    readonly RESUME: 2;
    readonly REBASE: 3;
};
export type OracleInstruction = (typeof OracleInstruction)[keyof typeof OracleInstruction];
/**
 * Contract status and error codes (0x2001 - 0x2013)
 */
export declare const OracleErrorCode: {
    readonly INVALID_INSTR_SIZE: 8193;
    readonly INVALID_INSTR_TYPE: 8194;
    readonly UNAUTHORIZED: 8195;
    readonly DATA_ACCESS_FAILED: 8196;
    readonly ACCOUNT_INIT_FAILED: 8197;
    readonly INVALID_COUNT: 8198;
    readonly CIRCUIT_BREAKER: 8199;
    readonly ALREADY_INITIALIZED: 8200;
    readonly STALE_TIMESTAMP: 8201;
    readonly FUTURE_SKEW: 8202;
    readonly DUPLICATE_SYMBOL: 8203;
    readonly INVALID_PRICE: 8204;
    readonly CLOCK_UNAVAILABLE: 8205;
    readonly ENTRY_TIMESTAMP: 8206;
    readonly SYMBOL_CAPACITY: 8207;
    readonly INVALID_SYMBOL: 8208;
    readonly NOT_TRIPPED: 8209;
    readonly INVALID_REGIME: 8210;
    readonly RESIZE_FAILED: 8211;
    readonly INVALID_VOLATILITY: 8212;
};
export type OracleErrorCode = (typeof OracleErrorCode)[keyof typeof OracleErrorCode];
/**
 * Descriptive human-readable explanations for Oracle contract errors
 */
export declare const OracleErrorMessages: Record<number, string>;
/**
 * Human-readable mapping of market regimes
 */
export declare const RegimeNames: Record<number, string>;
/**
 * Canonical 32-asset registry matching on-chain and Go feeder IDs
 */
export declare const KnownSymbolMap: Record<number, string>;
export declare const ReverseSymbolMap: Record<string, number>;
/**
 * Single market asset quote unpacked from binary wire
 */
export interface OracleEntry {
    symbolId: number;
    symbol: string;
    priceQ64Hi: bigint;
    priceQ64Lo: bigint;
    price: number;
    priceDecimal: string;
    volatilityBps: number;
    timestamp: number;
    ageSec: number;
}
/**
 * Deserialized state of the on-chain Oracle storage account
 */
export interface OracleState {
    version: number;
    authorityPubkey: string;
    circuitBreakerActive: boolean;
    regimeId: number;
    regimeName: string;
    lastUpdateTs: number;
    feedAgeSec: number;
    entryCount: number;
    entries: OracleEntry[];
    bySymbol: Record<string, OracleEntry>;
    byId: Record<number, OracleEntry>;
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
    haircutPercent: number;
    quote?: OracleEntry;
}
/**
 * Client configuration options
 */
export interface OracleClientOptions {
    rpcUrl?: string;
    daemonUrl?: string;
    accountAddress?: string;
    programId?: string;
    timeoutMs?: number;
}
//# sourceMappingURL=types.d.ts.map