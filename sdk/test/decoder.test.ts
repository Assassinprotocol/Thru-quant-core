import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  decodeOracleAccount,
  decodeOracleBase64,
  decodeOracleHex,
} from "../src/decoder.ts";
import {
  ORACLE_ACCOUNT_EXPECTED_SIZE,
  ORACLE_HEADER_SIZE,
} from "../src/types.ts";

describe("Binary Wire Decoder (decoder.ts)", () => {
  test("rejects buffers smaller than header size (52 bytes)", () => {
    const shortBuf = new Uint8Array(20);
    assert.throws(
      () => decodeOracleAccount(shortBuf),
      (err: any) => err instanceof RangeError && err.message.includes("52 bytes")
    );
  });

  test("rejects unsupported oracle versions", () => {
    const badVerBuf = new Uint8Array(ORACLE_HEADER_SIZE);
    const view = new DataView(badVerBuf.buffer);
    view.setUint32(0, 2, true); // version 2

    assert.throws(
      () => decodeOracleAccount(badVerBuf),
      (err: any) => err.message.includes("expected 1, got 2")
    );
  });

  test("rejects excessive entry count (>32)", () => {
    const badCountBuf = new Uint8Array(ORACLE_HEADER_SIZE);
    const view = new DataView(badCountBuf.buffer);
    view.setUint32(0, 1, true);  // version 1
    view.setUint32(48, 33, true); // entry count 33

    assert.throws(
      () => decodeOracleAccount(badCountBuf),
      (err: any) => err instanceof RangeError && err.message.includes("exceeds MAX_ORACLE_SYMBOLS")
    );
  });

  test("rejects truncated buffer for declared entries", () => {
    // 5 entries require 52 + 5 * 28 = 192 bytes
    const truncatedBuf = new Uint8Array(100);
    const view = new DataView(truncatedBuf.buffer);
    view.setUint32(0, 1, true); // version 1
    view.setUint32(48, 5, true); // 5 entries declared

    assert.throws(
      () => decodeOracleAccount(truncatedBuf),
      (err: any) => err instanceof RangeError && err.message.includes("truncated")
    );
  });

  test("correctly decodes valid minimal synthetic state", () => {
    // 1 entry: size = 52 + 28 = 80 bytes
    const buf = new Uint8Array(80);
    const view = new DataView(buf.buffer);
    view.setUint32(0, 1, true); // version 1
    view.setUint8(36, 0);       // circuit breaker inactive
    view.setUint32(40, 1, true);// regime: TRENDING_UP
    view.setUint32(44, 1000, true); // lastUpdateTs: 1000
    view.setUint32(48, 1, true);    // entryCount: 1

    // Entry 0: BTCUSDT (symbolId=1)
    view.setUint32(52, 1, true);           // symbolId: 1
    view.setBigUint64(56, 83459n, true);   // pHi: 83459
    view.setBigUint64(64, 1n << 63n, true);// pLo: 0.5
    view.setUint32(72, 150, true);         // volBps: 150
    view.setUint32(76, 1000, true);        // ts: 1000

    const state = decodeOracleAccount(buf, 1050); // now = 1050 (age = 50s)

    assert.equal(state.version, 1);
    assert.equal(state.circuitBreakerActive, false);
    assert.equal(state.regimeId, 1);
    assert.equal(state.regimeName, "TRENDING_UP");
    assert.equal(state.entryCount, 1);
    assert.equal(state.feedAgeSec, 50);

    // Assert O(1) indexed lookups
    const btc = state.bySymbol["BTCUSDT"];
    assert.ok(btc, "BTCUSDT should exist in bySymbol");
    assert.equal(btc.symbolId, 1);
    assert.equal(btc.price, 83459.5);
    assert.equal(btc.priceDecimal, "83459.50000000");
    assert.equal(btc.volatilityBps, 150);
    assert.equal(btc.ageSec, 50);

    const btcById = state.byId[1];
    assert.equal(btcById, btc);
  });
});
