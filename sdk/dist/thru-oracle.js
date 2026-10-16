/**
 * @thru-quant/core-sdk v0.4.0 (Standalone Zero-Dependency Bundle)
 * Thru Quant Data & Risk Engine
 * Built for Thru Network (Node.js, Bun, Deno, Modern Browser)
 */

// === Module: types.js ===
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
// === Module: math.js ===
/**
 * @file math.ts
 * @description Fixed-point Q64.64 arithmetic, arbitrary-precision BigInt decimal scaling, and quant utilities.
 */
const Q64_ONE = 1n << 64n; // 2^64 = 18446744073709551616n
const TWO_POW_64_FLOAT = Math.pow(2, 64);
/**
 * Converts Q64.64 limbs (hi, lo) into standard IEEE-754 double precision float.
 * Ideal for charts, UI dashboards, and non-accounting display.
 */
export function q64ToNumber(hi, lo) {
    return Number(hi) + Number(lo) / TWO_POW_64_FLOAT;
}
/**
 * Converts Q64.64 limbs into an EXACT decimal string representation using BigInt scaling.
 * Eliminates IEEE-754 mantissa precision loss (preserves sub-satoshi precision).
 *
 * @param hi High 64 bits (integer limb)
 * @param lo Low 64 bits (fractional limb)
 * @param precision Number of decimal places (default: 8)
 */
export function q64ToDecimalString(hi, lo, precision = 8) {
    if (precision <= 0) {
        return hi.toString();
    }
    const scale = 10n ** BigInt(precision);
    // Integer division with half-up rounding: (lo * scale + Q64_ONE / 2) / Q64_ONE
    let fracScaled = (lo * scale + (Q64_ONE >> 1n)) / Q64_ONE;
    let integerPart = hi;
    // Handle fractional overflow carry
    if (fracScaled >= scale) {
        integerPart += 1n;
        fracScaled -= scale;
    }
    const fracStr = fracScaled.toString().padStart(precision, "0");
    return `${integerPart.toString()}.${fracStr}`;
}
/**
 * Converts Q64.64 limbs to an integer scaled to a fixed number of decimals (e.g. 10^8 for satoshis).
 */
export function q64ToScaledBigInt(hi, lo, scaleDecimals = 8) {
    const scale = 10n ** BigInt(scaleDecimals);
    const fracScaled = (lo * scale) / Q64_ONE;
    return hi * scale + fracScaled;
}
/**
 * Converts a float into Q64.64 limbs (hi, lo).
 */
export function numberToQ64(val) {
    if (val < 0 || !Number.isFinite(val)) {
        throw new RangeError("Q64.64 only supports non-negative finite numbers");
    }
    const hi = BigInt(Math.floor(val));
    const frac = val - Math.floor(val);
    const lo = BigInt(Math.round(frac * TWO_POW_64_FLOAT));
    return { hi, lo };
}
/**
 * Converts an exact decimal string (e.g. "83459.50000000") into Q64.64 limbs without float conversion.
 */
export function decimalStringToQ64(val) {
    const parts = val.trim().split(".");
    const intStr = parts[0] || "0";
    const hi = BigInt(intStr);
    if (parts.length === 1 || !parts[1]) {
        return { hi, lo: 0n };
    }
    const fracStr = parts[1];
    const fracNumerator = BigInt(fracStr);
    const fracDenominator = 10n ** BigInt(fracStr.length);
    // lo = (fracNumerator * 2^64) / fracDenominator
    const lo = (fracNumerator * Q64_ONE) / fracDenominator;
    return { hi, lo };
}
/**
 * Formats basis points into human-readable percentage string (e.g. 150 -> "1.50%").
 */
export function formatBps(bps) {
    return `${(bps / 100).toFixed(2)}%`;
}
//# sourceMappingURL=math.js.map
// === Module: decoder.js ===
/**
 * @file decoder.ts
 * @description Zero-copy, little-endian binary wire deserializer for on-chain Oracle storage accounts.
 */
/**
 * Deserializes raw Little-Endian binary bytes into an unpacked, indexed OracleState object.
 *
 * @param bytes Raw Uint8Array of account storage data (expected 948 bytes)
 * @param nowSec Optional current timestamp for deterministic age calculation
 * @returns OracleState with pre-indexed bySymbol and byId lookups
 */
export function decodeOracleAccount(bytes, nowSec) {
    if (bytes.length < ORACLE_HEADER_SIZE) {
        throw new RangeError(`Buffer smaller than oracle header size (52 bytes): got ${bytes.length}`);
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const version = view.getUint32(0, true);
    if (version !== 1) {
        throw new Error(`Unsupported oracle state version: expected 1, got ${version}`);
    }
    // Authority pubkey (32 bytes at offset 4)
    let authorityHex = "";
    for (let i = 0; i < 32; i++) {
        authorityHex += bytes[4 + i].toString(16).padStart(2, "0");
    }
    const circuitBreakerActive = view.getUint8(36) !== 0;
    const regimeId = view.getUint32(40, true);
    const lastUpdateTs = view.getUint32(44, true);
    const entryCount = view.getUint32(48, true);
    if (entryCount > MAX_ORACLE_SYMBOLS) {
        throw new RangeError(`Oracle entry count exceeds MAX_ORACLE_SYMBOLS (32): got ${entryCount}`);
    }
    const requiredSize = ORACLE_HEADER_SIZE + entryCount * ORACLE_ENTRY_SIZE;
    if (bytes.length < requiredSize) {
        throw new RangeError(`Binary buffer truncated: got ${bytes.length} bytes, need ${requiredSize}`);
    }
    const currentTs = nowSec ?? Math.floor(Date.now() / 1000);
    const feedAgeSec = currentTs > lastUpdateTs && lastUpdateTs > 0 ? currentTs - lastUpdateTs : 0;
    const entries = [];
    const bySymbol = {};
    const byId = {};
    let offset = ORACLE_HEADER_SIZE;
    for (let i = 0; i < entryCount; i++) {
        const symbolId = view.getUint32(offset, true);
        const priceQ64Hi = view.getBigUint64(offset + 4, true);
        const priceQ64Lo = view.getBigUint64(offset + 12, true);
        const volatilityBps = view.getUint32(offset + 20, true);
        const timestamp = view.getUint32(offset + 24, true);
        offset += ORACLE_ENTRY_SIZE;
        const ageSec = currentTs > timestamp && timestamp > 0 ? currentTs - timestamp : 0;
        const symbol = KnownSymbolMap[symbolId] || `UNKNOWN_${symbolId}`;
        const price = q64ToNumber(priceQ64Hi, priceQ64Lo);
        const priceDecimal = q64ToDecimalString(priceQ64Hi, priceQ64Lo, 8);
        const entry = {
            symbolId,
            symbol,
            priceQ64Hi,
            priceQ64Lo,
            price,
            priceDecimal,
            volatilityBps,
            timestamp,
            ageSec,
        };
        entries.push(entry);
        bySymbol[symbol] = entry;
        byId[symbolId] = entry;
    }
    return {
        version,
        authorityPubkey: authorityHex,
        circuitBreakerActive,
        regimeId,
        regimeName: RegimeNames[regimeId] || "UNKNOWN",
        lastUpdateTs,
        feedAgeSec,
        entryCount,
        entries,
        bySymbol,
        byId,
        sourceMode: "ON_CHAIN_DECODED",
    };
}
/**
 * Decodes a base64-encoded on-chain account data string into OracleState.
 */
export function decodeOracleBase64(b64Str, nowSec) {
    const cleanB64 = b64Str.trim().replace(/-/g, "+").replace(/_/g, "/");
    const binaryString = typeof Buffer !== "undefined"
        ? Buffer.from(cleanB64, "base64")
        : Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
    return decodeOracleAccount(new Uint8Array(binaryString), nowSec);
}
/**
 * Decodes a hex-encoded on-chain account data string into OracleState.
 */
export function decodeOracleHex(hexStr, nowSec) {
    const cleanHex = hexStr.trim().startsWith("0x")
        ? hexStr.trim().slice(2)
        : hexStr.trim();
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }
    return decodeOracleAccount(bytes, nowSec);
}
//# sourceMappingURL=decoder.js.map
// === Module: encoder.js ===
/**
 * @file encoder.ts
 * @description Binary Little-Endian transaction instruction serializer for Thru Quant Oracle.
 */
export const UPDATE_HEADER_SIZE = 18;
export const RESUME_ARGS_SIZE = 6;
/**
 * Serializes an Oracle Price Update instruction payload.
 * Matches C struct `oracle_update_hdr_t` followed by `oracle_entry_t[count]`.
 *
 * @param args OracleUpdateArgs containing entries, regime, timestamp, and account index
 * @returns Little-Endian binary payload (18 + count * 28 bytes)
 */
export function encodeOracleUpdate(args) {
    if (args.entries.length > MAX_ORACLE_SYMBOLS) {
        throw new RangeError(`Cannot encode more than ${MAX_ORACLE_SYMBOLS} symbols in a single update: got ${args.entries.length}`);
    }
    const totalLength = UPDATE_HEADER_SIZE + args.entries.length * ORACLE_ENTRY_SIZE;
    const buffer = new ArrayBuffer(totalLength);
    const view = new DataView(buffer);
    // Header (18 bytes)
    view.setUint32(0, OracleInstruction.UPDATE_PRICES, true); // uint32 = 1
    view.setUint16(4, args.oracleAccountIdx, true); // uint16
    view.setUint32(6, args.regimeId, true); // uint32
    view.setUint32(10, args.timestamp, true); // uint32
    view.setUint32(14, args.entries.length, true); // uint32
    // Entries (28 bytes each)
    let offset = UPDATE_HEADER_SIZE;
    for (const entry of args.entries) {
        view.setUint32(offset, entry.symbolId, true);
        view.setBigUint64(offset + 4, entry.priceQ64Hi, true);
        view.setBigUint64(offset + 12, entry.priceQ64Lo, true);
        view.setUint32(offset + 20, entry.volatilityBps, true);
        view.setUint32(offset + 24, entry.timestamp, true);
        offset += ORACLE_ENTRY_SIZE;
    }
    return new Uint8Array(buffer);
}
/**
 * Serializes an Oracle Circuit Breaker Resume instruction payload.
 * Matches C struct `oracle_resume_args_t` (6 bytes canonical wire representation).
 *
 * @param accountIdx Account index within transaction accounts array (typically 2)
 * @returns 6-byte Little-Endian Uint8Array (canonical: 020000000200)
 */
export function encodeOracleResume(accountIdx = 2) {
    const buffer = new ArrayBuffer(RESUME_ARGS_SIZE);
    const view = new DataView(buffer);
    view.setUint32(0, OracleInstruction.RESUME, true); // uint32 = 2
    view.setUint16(4, accountIdx, true); // uint16
    return new Uint8Array(buffer);
}
//# sourceMappingURL=encoder.js.map
// === Module: guards.js ===
/**
 * @file guards.ts
 * @description Risk guards, staleness validation, and automated haircut policies for downstream DeFi consumers.
 */
/**
 * Checks if an on-chain Oracle quote or state is stale.
 *
 * @param lastUpdateTs Unix timestamp of the last quote
 * @param nowSec Optional current timestamp
 * @param maxAgeSec Maximum allowable age in seconds (default: 120s)
 */
export function isFeedStale(lastUpdateTs, nowSec, maxAgeSec = MAX_QUOTE_AGE_SECONDS) {
    if (lastUpdateTs === 0)
        return true;
    const current = nowSec ?? Math.floor(Date.now() / 1000);
    return current > lastUpdateTs && current - lastUpdateTs > maxAgeSec;
}
/**
 * Checks if the contract circuit breaker is currently active.
 */
export function isCircuitBreakerActive(state) {
    return state.circuitBreakerActive;
}
/**
 * Checks if a timestamp violates future clock-skew tolerance (default: 30s).
 */
export function isFutureSkew(timestamp, nowSec, maxSkewSec = MAX_FUTURE_SKEW_SECONDS) {
    const current = nowSec ?? Math.floor(Date.now() / 1000);
    return timestamp > current + maxSkewSec;
}
/**
 * Evaluates an asset against institutional risk policies:
 * 1. Circuit breaker gate
 * 2. Feed staleness gate (max 120s)
 * 3. Future clock skew gate (max 30s)
 * 4. Volatility spike gate (applies dynamic margin haircut)
 *
 * @param state Deserialized on-chain OracleState
 * @param symbol Market asset symbol (e.g. "BTCUSDT")
 * @param options Risk evaluation parameters
 * @returns RiskEvaluationResult with pass/fail and recommended collateral haircut
 */
export function evaluateRiskGate(state, symbol, options) {
    const now = options?.nowSec ?? Math.floor(Date.now() / 1000);
    const maxAge = options?.maxAgeSec ?? MAX_QUOTE_AGE_SECONDS;
    const maxVolBps = options?.maxVolatilityBps ?? 400; // 4.00% default threshold
    // Gate 1: Circuit breaker check
    if (state.circuitBreakerActive) {
        return {
            passed: false,
            reason: "CIRCUIT_BREAKER_ACTIVE",
            haircutPercent: 100,
        };
    }
    // Gate 2: Symbol existence (O(1) indexed lookup)
    const quote = state.bySymbol[symbol];
    if (!quote) {
        return {
            passed: false,
            reason: `SYMBOL_NOT_FOUND: ${symbol}`,
            haircutPercent: 100,
        };
    }
    // Gate 3: Staleness check
    if (quote.timestamp === 0 || (now > quote.timestamp && now - quote.timestamp > maxAge)) {
        return {
            passed: false,
            reason: `STALE_QUOTE: age ${now - quote.timestamp}s exceeds limit ${maxAge}s`,
            haircutPercent: 100,
            quote,
        };
    }
    // Gate 4: Clock skew check
    if (quote.timestamp > now + MAX_FUTURE_SKEW_SECONDS) {
        return {
            passed: false,
            reason: `FUTURE_SKEW: timestamp ${quote.timestamp} ahead of now ${now}`,
            haircutPercent: 100,
            quote,
        };
    }
    // Gate 5: Volatility check and dynamic haircut
    if (quote.volatilityBps > maxVolBps) {
        return {
            passed: true,
            reason: `HIGH_VOLATILITY: ${quote.volatilityBps} bps exceeds ${maxVolBps} bps (haircut applied)`,
            haircutPercent: 25, // Recommend 25% collateral haircut
            quote,
        };
    }
    return {
        passed: true,
        haircutPercent: 0,
        quote,
    };
}
//# sourceMappingURL=guards.js.map
// === Module: client.js ===
/**
 * @file client.ts
 * @description High-level dual-transport client for Thru Quant Oracle (Alphanet RPC + Local Daemon REST).
 */
const DEFAULT_ACCOUNT_ADDRESS = "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN";
const DEFAULT_DAEMON_URL = "http://localhost:8082";
const DEFAULT_RPC_URL = "https://alphanet.thru.network/rpc";
/**
 * Unified Oracle Client supporting direct Alphanet JSON-RPC and Local Go Daemon REST transports.
 */
export class OracleClient {
    rpcUrl;
    daemonUrl;
    accountAddress;
    timeoutMs;
    constructor(options = {}) {
        this.rpcUrl = options.rpcUrl || DEFAULT_RPC_URL;
        this.daemonUrl = options.daemonUrl || DEFAULT_DAEMON_URL;
        this.accountAddress = options.accountAddress || DEFAULT_ACCOUNT_ADDRESS;
        this.timeoutMs = options.timeoutMs || 5000;
    }
    /**
     * Fetches latest Oracle state from the local Daemon or falls back to direct JSON-RPC.
     */
    async getLatestState() {
        try {
            return await this.fetchFromDaemon();
        }
        catch (_daemonErr) {
            // Automatic transparent failover to direct Thru Alphanet JSON-RPC
            return await this.fetchFromRpc();
        }
    }
    /**
     * Fetches latest quote for a specific ticker symbol (O(1) lookup).
     */
    async getQuote(symbol) {
        const state = await this.getLatestState();
        const quote = state.bySymbol[symbol];
        if (!quote) {
            throw new Error(`Symbol '${symbol}' not found in Oracle active registry`);
        }
        return quote;
    }
    /**
     * Evaluates operational readiness probe (/ready).
     */
    async isReady() {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), this.timeoutMs);
            const res = await fetch(`${this.daemonUrl}/ready`, {
                signal: controller.signal,
            });
            clearTimeout(id);
            if (!res.ok)
                return false;
            const data = (await res.json());
            return !!data.ready;
        }
        catch (_e) {
            // Fallback: query state and verify freshness
            try {
                const state = await this.fetchFromRpc();
                return !state.circuitBreakerActive && state.feedAgeSec <= 120;
            }
            catch {
                return false;
            }
        }
    }
    /**
     * Evaluates risk gate policies for a specific asset against live on-chain state.
     */
    async checkRiskGate(symbol, options) {
        const state = await this.getLatestState();
        return evaluateRiskGate(state, symbol, options);
    }
    /**
     * Fetches state directly from the local Go HTTP Daemon (/v1/oracle/latest).
     */
    async fetchFromDaemon() {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);
        const res = await fetch(`${this.daemonUrl}/v1/oracle/latest`, {
            signal: controller.signal,
        });
        clearTimeout(id);
        if (!res.ok) {
            throw new Error(`Daemon error: HTTP ${res.status}`);
        }
        const json = (await res.json());
        // Ensure indexed lookups are initialized
        if (!json.bySymbol || !json.byId) {
            json.bySymbol = {};
            json.byId = {};
            for (const entry of json.entries || []) {
                json.bySymbol[entry.symbol] = entry;
                json.byId[entry.symbolId] = entry;
            }
        }
        return json;
    }
    /**
     * Fetches and deserializes state directly from Thru Alphanet JSON-RPC.
     */
    async fetchFromRpc() {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), this.timeoutMs);
        const payload = {
            jsonrpc: "2.0",
            id: 1,
            method: "thru_getAccountInfo",
            params: [this.accountAddress, { encoding: "base64" }],
        };
        const res = await fetch(this.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(id);
        if (!res.ok) {
            throw new Error(`Thru RPC HTTP error: ${res.status}`);
        }
        const data = (await res.json());
        if (data.error) {
            throw new Error(`Thru RPC error: ${data.error.message}`);
        }
        let b64 = "";
        if (typeof data.result?.data === "string") {
            b64 = data.result.data;
        }
        else if (Array.isArray(data.result?.data) && data.result.data.length > 0) {
            b64 = data.result.data[0];
        }
        else {
            throw new Error("Invalid or empty account data returned by Thru RPC");
        }
        return decodeOracleBase64(b64);
    }
}
//# sourceMappingURL=client.js.map
