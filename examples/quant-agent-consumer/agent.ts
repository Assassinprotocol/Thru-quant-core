/**
 * @file agent.ts
 * @description Autonomous Quant Risk-Agent and Margin Haircut Consumer.
 * Demonstrates deterministic consumption of Thru Quant Core Oracle on-chain state.
 */

import fs from "node:fs";
import path from "node:path";
import {
  OracleClient,
  decodeOracleHex,
  evaluateRiskGate,
  formatBps,
  type OracleState,
  type OracleEntry,
} from "@thru-quant/core-sdk";

const isDryRun = process.argv.includes("--dry-run");
const PORTFOLIO_NAV_USD = 100_000.0; // $100k Base Quant Capital
const MAX_RISK_PER_TRADE_BPS = 100;   // 1.00% max capital risk per position ($1,000)

interface TradeIntent {
  symbol: string;
  priceUsd: number;
  volatilityBps: number;
  haircutPercent: number;
  allocatedCapitalUsd: number;
  positionUnits: number;
  status: "AUTHORIZED" | "REJECTED" | "HAIRCUT_MODIFIED";
  reason: string;
}

class AutonomousQuantRiskAgent {
  private lastProcessedTimestamp: number = 0;
  private client: OracleClient;

  constructor() {
    this.client = new OracleClient({
      daemonUrl: "http://localhost:8082",
      rpcUrl: "https://alphanet.thru.network/rpc",
    });
  }

  /**
   * Evaluates state with anti-replay and clock-skew regression protection.
   */
  public evaluateState(state: OracleState, nowSec: number): TradeIntent[] {
    console.log(`\n\x1b[1m\x1b[35m[QUANT RISK AGENT]\x1b[0m Evaluating On-Chain Oracle State:`);
    console.log(`  Version: ${state.version} | Regime: \x1b[33m${state.regimeName}\x1b[0m | Assets: ${state.entryCount}`);
    console.log(`  Feed Timestamp: ${new Date(state.lastUpdateTs * 1000).toISOString()}`);

    // Invariant 1: Circuit breaker trip
    if (state.circuitBreakerActive) {
      console.error(`\x1b[1m\x1b[31m[CRITICAL]\x1b[0m Circuit breaker ACTIVE! Emergency halting all trade evaluation.`);
      return [];
    }

    // Invariant 2: Monotonic sequence & timestamp check (anti-replay protection)
    if (state.lastUpdateTs < this.lastProcessedTimestamp) {
      console.warn(
        `\x1b[31m[REPLAY ANOMALY]\x1b[0m Stale timestamp regression detected: current ${state.lastUpdateTs} < previous ${this.lastProcessedTimestamp}. Discarding update.`
      );
      return [];
    }
    this.lastProcessedTimestamp = state.lastUpdateTs;

    const targetSymbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    const results: TradeIntent[] = [];

    for (const sym of targetSymbols) {
      const risk = evaluateRiskGate(state, sym, { nowSec, maxVolatilityBps: 200 });

      if (!risk.passed || !risk.quote) {
        console.log(`  \x1b[31m[-] ${sym.padEnd(8)}\x1b[0m REJECTED: ${risk.reason}`);
        results.push({
          symbol: sym,
          priceUsd: risk.quote?.price ?? 0,
          volatilityBps: risk.quote?.volatilityBps ?? 0,
          haircutPercent: 100,
          allocatedCapitalUsd: 0,
          positionUnits: 0,
          status: "REJECTED",
          reason: risk.reason || "RISK_GATE_FAILED",
        });
        continue;
      }

      const quote = risk.quote;
      // Position sizing model:
      // Base risk allocation = 1% NAV ($1,000)
      // If volatility > 200 bps, haircutPercent is 25% (reduces sizing by 25%)
      const baseRiskCapital = (PORTFOLIO_NAV_USD * MAX_RISK_PER_TRADE_BPS) / 10000;
      const effectiveCapital = baseRiskCapital * (1 - risk.haircutPercent / 100);
      const positionUnits = effectiveCapital / quote.price;

      const status = risk.haircutPercent > 0 ? "HAIRCUT_MODIFIED" : "AUTHORIZED";
      const statusColor = risk.haircutPercent > 0 ? "\x1b[33m" : "\x1b[32m";

      console.log(
        `  ${statusColor}[+] ${sym.padEnd(8)}\x1b[0m ${status.padEnd(16)} Price: $${quote.price.toFixed(2).padStart(10)} | Vol: ${formatBps(quote.volatilityBps).padStart(6)} | Sizing: ${positionUnits.toFixed(4)} ($${effectiveCapital.toFixed(2)})`
      );

      results.push({
        symbol: sym,
        priceUsd: quote.price,
        volatilityBps: quote.volatilityBps,
        haircutPercent: risk.haircutPercent,
        allocatedCapitalUsd: effectiveCapital,
        positionUnits,
        status,
        reason: risk.reason || "ALL_GATES_PASSED",
      });
    }

    return results;
  }

  public async run(): Promise<void> {
    if (isDryRun) {
      console.log("\x1b[1m\x1b[36m[DRY-RUN MODE]\x1b[0m Running standalone verification against canonical test fixture...");
      const fixturePath = path.resolve(
        import.meta.dirname,
        "../../testdata/fixtures/oracle_state_alphanet_slot_7743340.hex"
      );
      const rawHex = fs.readFileSync(fixturePath, "utf-8").trim();
      const state = decodeOracleHex(rawHex, 1791968301);

      const intents = this.evaluateState(state, 1791968301);
      console.log(`\n\x1b[32m[VERIFIED]\x1b[0m Dry-run complete. Processed ${intents.length} assets with zero runtime errors.`);
      return;
    }

    console.log("\x1b[34m[LIVE AGENT]\x1b[0m Starting polling loop (checking readiness probe)...");
    const isReady = await this.client.isReady();
    console.log(`Operational readiness: ${isReady ? "\x1b[32mREADY\x1b[0m" : "\x1b[31mNOT_READY\x1b[0m"}`);

    try {
      const state = await this.client.getLatestState();
      this.evaluateState(state, Math.floor(Date.now() / 1000));
    } catch (err: any) {
      console.error(`Live evaluation error:`, err.message);
    }
  }
}

const agent = new AutonomousQuantRiskAgent();
agent.run().catch((err) => {
  console.error("Agent runtime error:", err);
  process.exit(1);
});
