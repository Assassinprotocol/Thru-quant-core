import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decodeOracleHex, decodeOracleAccount } from "../src/decoder.ts";
import { encodeOracleResume } from "../src/encoder.ts";
import { evaluateRiskGate } from "../src/guards.ts";

const FIXTURES_DIR = path.resolve(import.meta.dirname, "../../testdata/fixtures");

describe("Cross-Language Test Fixtures & Wire Parity (TS vs Go vs C)", () => {
  test("decodes real Alphanet slot 7743340 fixture identically to Go decoder", () => {
    const hexPath = path.join(FIXTURES_DIR, "oracle_state_alphanet_slot_7743340.hex");
    const jsonPath = path.join(FIXTURES_DIR, "oracle_state_alphanet_slot_7743340.json");

    const rawHex = fs.readFileSync(hexPath, "utf-8").trim();
    const goldenJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

    const state = decodeOracleHex(rawHex, goldenJson.last_update_ts);

    // Assert Header fields match Go decoder exactly
    assert.equal(state.version, goldenJson.version);
    assert.equal(state.authorityPubkey, goldenJson.authority_pubkey);
    assert.equal(state.circuitBreakerActive, goldenJson.circuit_breaker_active);
    assert.equal(state.regimeId, goldenJson.regime_id);
    assert.equal(state.regimeName, goldenJson.regime_name);
    assert.equal(state.lastUpdateTs, goldenJson.last_update_ts);
    assert.equal(state.entryCount, goldenJson.entry_count);
    assert.equal(state.entries.length, goldenJson.entries.length);

    // Assert each individual entry matches Go golden JSON
    for (let i = 0; i < state.entries.length; i++) {
      const tsEntry = state.entries[i];
      const goEntry = goldenJson.entries[i];

      assert.equal(tsEntry.symbolId, goEntry.symbol_id);
      assert.equal(tsEntry.symbol, goEntry.symbol);
      assert.equal(tsEntry.priceQ64Hi, BigInt(goEntry.price_q64_hi));
      assert.equal(tsEntry.priceQ64Lo, BigInt(goEntry.price_q64_lo));
      assert.equal(tsEntry.volatilityBps, goEntry.volatility_bps);
      assert.equal(tsEntry.timestamp, goEntry.timestamp);

      // Verify float numerical tolerance (within float64 precision limit)
      assert.ok(
        Math.abs(tsEntry.price - goEntry.price) < 1e-9,
        `Price mismatch on ${tsEntry.symbol}: TS=${tsEntry.price} Go=${goEntry.price}`
      );
    }

    // Verify O(1) indexed lookups
    const btc = state.bySymbol["BTCUSDT"];
    assert.ok(btc, "BTCUSDT must exist in bySymbol");
    assert.equal(btc.symbolId, 1);
    assert.equal(btc.price, 83459.5);
    assert.equal(btc.priceDecimal, "83459.50000000");
    assert.equal(btc.volatilityBps, 150);
  });

  test("verifies circuit breaker tripped fixture", () => {
    const cbPath = path.join(FIXTURES_DIR, "oracle_state_circuit_breaker.hex");
    const rawHex = fs.readFileSync(cbPath, "utf-8").trim();

    const state = decodeOracleHex(rawHex);
    assert.equal(state.circuitBreakerActive, true);

    // Risk evaluation on tripped state must HALT immediately
    const risk = evaluateRiskGate(state, "BTCUSDT");
    assert.equal(risk.passed, false);
    assert.equal(risk.reason, "CIRCUIT_BREAKER_ACTIVE");
    assert.equal(risk.haircutPercent, 100);
  });

  test("verifies resume instruction hex matches TS encoder output", () => {
    const resumePath = path.join(FIXTURES_DIR, "oracle_resume_instruction.hex");
    const expectedHex = fs.readFileSync(resumePath, "utf-8").trim();

    const resumeBytes = encodeOracleResume(2);
    const generatedHex = Buffer.from(resumeBytes).toString("hex");

    assert.equal(generatedHex, expectedHex);
    assert.equal(generatedHex, "020000000200");
  });

  test("evaluates risk policies against Alphanet state", () => {
    const hexPath = path.join(FIXTURES_DIR, "oracle_state_alphanet_slot_7743340.hex");
    const rawHex = fs.readFileSync(hexPath, "utf-8").trim();
    const state = decodeOracleHex(rawHex, 1791968301); // exact same timestamp

    // 1. Fresh BTC quote passes with 0% haircut
    const btcRisk = evaluateRiskGate(state, "BTCUSDT", { nowSec: 1791968301 });
    assert.equal(btcRisk.passed, true);
    assert.equal(btcRisk.haircutPercent, 0);

    // 2. Stale evaluation (> 120s) rejects trade
    const staleRisk = evaluateRiskGate(state, "BTCUSDT", { nowSec: 1791968301 + 130 });
    assert.equal(staleRisk.passed, false);
    assert.ok(staleRisk.reason?.includes("STALE_QUOTE"));

    // 3. Volatility gate with low threshold (100 bps) applies 25% haircut
    const volRisk = evaluateRiskGate(state, "BTCUSDT", {
      nowSec: 1791968301,
      maxVolatilityBps: 100, // BTC vol is 150 bps
    });
    assert.equal(volRisk.passed, true);
    assert.equal(volRisk.haircutPercent, 25);
    assert.ok(volRisk.reason?.includes("HIGH_VOLATILITY"));
  });
});
