/**
 * @file client.ts
 * @description High-level dual-transport client for Thru Quant Oracle (Alphanet RPC + Local Daemon REST).
 */

import {
  type OracleClientOptions,
  type OracleState,
  type OracleEntry,
  type RiskGateOptions,
  type RiskEvaluationResult,
} from "./types.ts";
import { decodeOracleAccount, decodeOracleBase64 } from "./decoder.ts";
import { evaluateRiskGate } from "./guards.ts";

const DEFAULT_ACCOUNT_ADDRESS =
  "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN";
const DEFAULT_DAEMON_URL = "http://localhost:8082";
const DEFAULT_RPC_URL = "https://alphanet.thru.network/rpc";

/**
 * Unified Oracle Client supporting direct Alphanet JSON-RPC and Local Go Daemon REST transports.
 */
export class OracleClient {
  private rpcUrl: string;
  private daemonUrl: string;
  private accountAddress: string;
  private timeoutMs: number;

  constructor(options: OracleClientOptions = {}) {
    this.rpcUrl = options.rpcUrl || DEFAULT_RPC_URL;
    this.daemonUrl = options.daemonUrl || DEFAULT_DAEMON_URL;
    this.accountAddress = options.accountAddress || DEFAULT_ACCOUNT_ADDRESS;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  /**
   * Fetches latest Oracle state from the local Daemon or falls back to direct JSON-RPC.
   */
  async getLatestState(): Promise<OracleState> {
    try {
      return await this.fetchFromDaemon();
    } catch (_daemonErr) {
      // Automatic transparent failover to direct Thru Alphanet JSON-RPC
      return await this.fetchFromRpc();
    }
  }

  /**
   * Fetches latest quote for a specific ticker symbol (O(1) lookup).
   */
  async getQuote(symbol: string): Promise<OracleEntry> {
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
  async isReady(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(`${this.daemonUrl}/ready`, {
        signal: controller.signal,
      });
      clearTimeout(id);
      if (!res.ok) return false;
      const data = (await res.json()) as { ready?: boolean };
      return !!data.ready;
    } catch (_e) {
      // Fallback: query state and verify freshness
      try {
        const state = await this.fetchFromRpc();
        return !state.circuitBreakerActive && state.feedAgeSec <= 120;
      } catch {
        return false;
      }
    }
  }

  /**
   * Evaluates risk gate policies for a specific asset against live on-chain state.
   */
  async checkRiskGate(
    symbol: string,
    options?: RiskGateOptions
  ): Promise<RiskEvaluationResult> {
    const state = await this.getLatestState();
    return evaluateRiskGate(state, symbol, options);
  }

  /**
   * Fetches state directly from the local Go HTTP Daemon (/v1/oracle/latest).
   */
  async fetchFromDaemon(): Promise<OracleState> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    const res = await fetch(`${this.daemonUrl}/v1/oracle/latest`, {
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      throw new Error(`Daemon error: HTTP ${res.status}`);
    }

    const json = (await res.json()) as OracleState;
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
  async fetchFromRpc(): Promise<OracleState> {
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

    const data = (await res.json()) as {
      result?: { data?: string | string[] };
      error?: { message?: string };
    };

    if (data.error) {
      throw new Error(`Thru RPC error: ${data.error.message}`);
    }

    let b64 = "";
    if (typeof data.result?.data === "string") {
      b64 = data.result.data;
    } else if (Array.isArray(data.result?.data) && data.result.data.length > 0) {
      b64 = data.result.data[0];
    } else {
      throw new Error("Invalid or empty account data returned by Thru RPC");
    }

    return decodeOracleBase64(b64);
  }
}
