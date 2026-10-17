/**
 * @file guards.ts
 * @description Risk guards, staleness validation, and automated haircut policies for downstream DeFi consumers.
 */
import { MAX_QUOTE_AGE_SECONDS, MAX_FUTURE_SKEW_SECONDS, } from "./types.js";
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
 * Evaluates an asset against risk policies:
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