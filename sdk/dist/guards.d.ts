/**
 * @file guards.ts
 * @description Risk guards, staleness validation, and automated haircut policies for downstream DeFi consumers.
 */
import { type OracleState, type RiskGateOptions, type RiskEvaluationResult } from "./types.ts";
/**
 * Checks if an on-chain Oracle quote or state is stale.
 *
 * @param lastUpdateTs Unix timestamp of the last quote
 * @param nowSec Optional current timestamp
 * @param maxAgeSec Maximum allowable age in seconds (default: 120s)
 */
export declare function isFeedStale(lastUpdateTs: number, nowSec?: number, maxAgeSec?: number): boolean;
/**
 * Checks if the contract circuit breaker is currently active.
 */
export declare function isCircuitBreakerActive(state: OracleState): boolean;
/**
 * Checks if a timestamp violates future clock-skew tolerance (default: 30s).
 */
export declare function isFutureSkew(timestamp: number, nowSec?: number, maxSkewSec?: number): boolean;
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
export declare function evaluateRiskGate(state: OracleState, symbol: string, options?: RiskGateOptions): RiskEvaluationResult;
//# sourceMappingURL=guards.d.ts.map