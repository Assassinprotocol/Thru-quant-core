import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  q64ToNumber,
  q64ToDecimalString,
  q64ToScaledBigInt,
  numberToQ64,
  decimalStringToQ64,
  formatBps,
} from "../src/math.ts";

describe("Fixed-Point Q64.64 Math & Arbitrary-Precision Scaling", () => {
  test("converts simple integers correctly", () => {
    const num = q64ToNumber(100n, 0n);
    assert.equal(num, 100);

    const str = q64ToDecimalString(100n, 0n, 8);
    assert.equal(str, "100.00000000");

    const scaled = q64ToScaledBigInt(100n, 0n, 8);
    assert.equal(scaled, 10000000000n);
  });

  test("converts exact half (0.5 = 2^63)", () => {
    const halfLo = 1n << 63n; // 9223372036854775808n
    const num = q64ToNumber(0n, halfLo);
    assert.equal(num, 0.5);

    const str = q64ToDecimalString(0n, halfLo, 8);
    assert.equal(str, "0.50000000");

    const scaled = q64ToScaledBigInt(0n, halfLo, 8);
    assert.equal(scaled, 50000000n);
  });

  test("formats BTC canonical Alphanet price exactly", () => {
    // Slot 7743340 BTC: hi=83459, lo=9223372036854775808 (83459.50)
    const hi = 83459n;
    const lo = 9223372036854775808n;

    const num = q64ToNumber(hi, lo);
    assert.equal(num, 83459.5);

    const str = q64ToDecimalString(hi, lo, 8);
    assert.equal(str, "83459.50000000");

    const satoshis = q64ToScaledBigInt(hi, lo, 8);
    assert.equal(satoshis, 8345950000000n);
  });

  test("decimalStringToQ64 exact roundtrip", () => {
    const { hi, lo } = decimalStringToQ64("83459.5");
    assert.equal(hi, 83459n);
    assert.equal(lo, 1n << 63n);

    const backToStr = q64ToDecimalString(hi, lo, 2);
    assert.equal(backToStr, "83459.50");
  });

  test("numberToQ64 and boundary checks", () => {
    const { hi, lo } = numberToQ64(1.25);
    assert.equal(hi, 1n);
    assert.equal(lo, 1n << 62n); // 0.25 * 2^64

    assert.throws(() => numberToQ64(-5), RangeError);
    assert.throws(() => numberToQ64(Infinity), RangeError);
  });

  test("formatBps formats basis points cleanly", () => {
    assert.equal(formatBps(150), "1.50%");
    assert.equal(formatBps(500), "5.00%");
    assert.equal(formatBps(0), "0.00%");
    assert.equal(formatBps(25), "0.25%");
  });
});
