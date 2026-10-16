/**
 * @file math.ts
 * @description Fixed-point Q64.64 arithmetic, arbitrary-precision BigInt decimal scaling, and quant utilities.
 */
/**
 * Converts Q64.64 limbs (hi, lo) into standard IEEE-754 double precision float.
 * Ideal for charts, UI dashboards, and non-accounting display.
 */
export declare function q64ToNumber(hi: bigint, lo: bigint): number;
/**
 * Converts Q64.64 limbs into an EXACT decimal string representation using BigInt scaling.
 * Eliminates IEEE-754 mantissa precision loss (preserves sub-satoshi precision).
 *
 * @param hi High 64 bits (integer limb)
 * @param lo Low 64 bits (fractional limb)
 * @param precision Number of decimal places (default: 8)
 */
export declare function q64ToDecimalString(hi: bigint, lo: bigint, precision?: number): string;
/**
 * Converts Q64.64 limbs to an integer scaled to a fixed number of decimals (e.g. 10^8 for satoshis).
 */
export declare function q64ToScaledBigInt(hi: bigint, lo: bigint, scaleDecimals?: number): bigint;
/**
 * Converts a float into Q64.64 limbs (hi, lo).
 */
export declare function numberToQ64(val: number): {
    hi: bigint;
    lo: bigint;
};
/**
 * Converts an exact decimal string (e.g. "83459.50000000") into Q64.64 limbs without float conversion.
 */
export declare function decimalStringToQ64(val: string): {
    hi: bigint;
    lo: bigint;
};
/**
 * Formats basis points into human-readable percentage string (e.g. 150 -> "1.50%").
 */
export declare function formatBps(bps: number): string;
//# sourceMappingURL=math.d.ts.map