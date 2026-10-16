import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  encodeOracleUpdate,
  encodeOracleResume,
  UPDATE_HEADER_SIZE,
  RESUME_ARGS_SIZE,
} from "../src/encoder.ts";
import { OracleInstruction } from "../src/types.ts";

describe("Binary Wire Encoder (encoder.ts)", () => {
  test("encodeOracleResume generates canonical 6-byte payload (020000000200)", () => {
    const bytes = encodeOracleResume(2);
    assert.equal(bytes.length, RESUME_ARGS_SIZE);

    const hex = Buffer.from(bytes).toString("hex");
    assert.equal(hex, "020000000200");

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    assert.equal(view.getUint32(0, true), OracleInstruction.RESUME);
    assert.equal(view.getUint16(4, true), 2);
  });

  test("encodeOracleUpdate packs header and entries correctly", () => {
    const payload = encodeOracleUpdate({
      oracleAccountIdx: 2,
      regimeId: 1, // TRENDING_UP
      timestamp: 1700000000,
      entries: [
        {
          symbolId: 1, // BTCUSDT
          priceQ64Hi: 83459n,
          priceQ64Lo: 1n << 63n,
          volatilityBps: 150,
          timestamp: 1700000000,
        },
        {
          symbolId: 2, // ETHUSDT
          priceQ64Hi: 2650n,
          priceQ64Lo: 0n,
          volatilityBps: 180,
          timestamp: 1700000000,
        },
      ],
    });

    const expectedLength = UPDATE_HEADER_SIZE + 2 * 28; // 18 + 56 = 74 bytes
    assert.equal(payload.length, expectedLength);

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // Verify header
    assert.equal(view.getUint32(0, true), OracleInstruction.UPDATE_PRICES); // 1
    assert.equal(view.getUint16(4, true), 2);          // oracleAccountIdx
    assert.equal(view.getUint32(6, true), 1);          // regimeId
    assert.equal(view.getUint32(10, true), 1700000000);// timestamp
    assert.equal(view.getUint32(14, true), 2);         // entry_count

    // Verify Entry 0 (BTC)
    assert.equal(view.getUint32(18, true), 1);         // symbolId
    assert.equal(view.getBigUint64(22, true), 83459n); // priceQ64Hi
    assert.equal(view.getBigUint64(30, true), 1n << 63n); // priceQ64Lo
    assert.equal(view.getUint32(38, true), 150);       // volatilityBps
    assert.equal(view.getUint32(42, true), 1700000000);// timestamp

    // Verify Entry 1 (ETH)
    assert.equal(view.getUint32(46, true), 2);         // symbolId
    assert.equal(view.getBigUint64(50, true), 2650n);  // priceQ64Hi
    assert.equal(view.getBigUint64(58, true), 0n);     // priceQ64Lo
    assert.equal(view.getUint32(66, true), 180);       // volatilityBps
    assert.equal(view.getUint32(70, true), 1700000000);// timestamp
  });

  test("rejects encoding more than MAX_ORACLE_SYMBOLS (32)", () => {
    const entries = Array.from({ length: 33 }, (_, i) => ({
      symbolId: i + 1,
      priceQ64Hi: 100n,
      priceQ64Lo: 0n,
      volatilityBps: 100,
      timestamp: 1700000000,
    }));

    assert.throws(
      () =>
        encodeOracleUpdate({
          oracleAccountIdx: 2,
          regimeId: 0,
          timestamp: 1700000000,
          entries,
        }),
      (err: any) => err instanceof RangeError && err.message.includes("Cannot encode more than 32 symbols")
    );
  });
});
