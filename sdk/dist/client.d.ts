/**
 * @file client.ts
 * @description High-level dual-transport client for Thru Quant Oracle (Alphanet RPC + Local Daemon REST).
 */
import { type OracleClientOptions, type OracleState, type OracleEntry, type RiskGateOptions, type RiskEvaluationResult } from "./types.ts";
/**
 * Unified Oracle Client supporting direct Alphanet JSON-RPC and Local Go Daemon REST transports.
 */
export declare class OracleClient {
    private rpcUrl;
    private daemonUrl;
    private accountAddress;
    private timeoutMs;
    constructor(options?: OracleClientOptions);
    /**
     * Fetches latest Oracle state from the local Daemon or falls back to direct JSON-RPC.
     */
    getLatestState(): Promise<OracleState>;
    /**
     * Fetches latest quote for a specific ticker symbol (O(1) lookup).
     */
    getQuote(symbol: string): Promise<OracleEntry>;
    /**
     * Evaluates operational readiness probe (/ready).
     */
    isReady(): Promise<boolean>;
    /**
     * Evaluates risk gate policies for a specific asset against live on-chain state.
     */
    checkRiskGate(symbol: string, options?: RiskGateOptions): Promise<RiskEvaluationResult>;
    /**
     * Fetches state directly from the local Go HTTP Daemon (/v1/oracle/latest).
     */
    fetchFromDaemon(): Promise<OracleState>;
    /**
     * Fetches and deserializes state directly from Thru Alphanet JSON-RPC.
     */
    fetchFromRpc(): Promise<OracleState>;
}
//# sourceMappingURL=client.d.ts.map