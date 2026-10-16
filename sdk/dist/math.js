/**
 * @file math.ts
 * @description Fixed-point Q64.64 arithmetic, arbitrary-precision BigInt decimal scaling, and quant utilities.
 */
const Q64_ONE = 1n << 64n; // 2^64 = 18446744073709551616n
const TWO_POW_64_FLOAT = Math.pow(2, 64);
/**
 * Converts Q64.64 limbs (hi, lo) into standard IEEE-754 double precision float.
 * Ideal for charts, UI dashboards, and non-accounting display.
 */
export function q64ToNumber(hi, lo) {
    return Number(hi) + Number(lo) / TWO_POW_64_FLOAT;
}
/**
 * Converts Q64.64 limbs into an EXACT decimal string representation using BigInt scaling.
 * Eliminates IEEE-754 mantissa precision loss (preserves sub-satoshi precision).
 *
 * @param hi High 64 bits (integer limb)
 * @param lo Low 64 bits (fractional limb)
 * @param precision Number of decimal places (default: 8)
 */
export function q64ToDecimalString(hi, lo, precision = 8) {
    if (precision <= 0) {
        return hi.toString();
    }
    const scale = 10n ** BigInt(precision);
    // Integer division with half-up rounding: (lo * scale + Q64_ONE / 2) / Q64_ONE
    let fracScaled = (lo * scale + (Q64_ONE >> 1n)) / Q64_ONE;
    let integerPart = hi;
    // Handle fractional overflow carry
    if (fracScaled >= scale) {
        integerPart += 1n;
        fracScaled -= scale;
    }
    const fracStr = fracScaled.toString().padStart(precision, "0");
    return `${integerPart.toString()}.${fracStr}`;
}
/**
 * Converts Q64.64 limbs to an integer scaled to a fixed number of decimals (e.g. 10^8 for satoshis).
 */
export function q64ToScaledBigInt(hi, lo, scaleDecimals = 8) {
    const scale = 10n ** BigInt(scaleDecimals);
    const fracScaled = (lo * scale) / Q64_ONE;
    return hi * scale + fracScaled;
}
/**
 * Converts a float into Q64.64 limbs (hi, lo).
 */
export function numberToQ64(val) {
    if (val < 0 || !Number.isFinite(val)) {
        throw new RangeError("Q64.64 only supports non-negative finite numbers");
    }
    const hi = BigInt(Math.floor(val));
    const frac = val - Math.floor(val);
    const lo = BigInt(Math.round(frac * TWO_POW_64_FLOAT));
    return { hi, lo };
}
/**
 * Converts an exact decimal string (e.g. "83459.50000000") into Q64.64 limbs without float conversion.
 */
export function decimalStringToQ64(val) {
    const parts = val.trim().split(".");
    const intStr = parts[0] || "0";
    const hi = BigInt(intStr);
    if (parts.length === 1 || !parts[1]) {
        return { hi, lo: 0n };
    }
    const fracStr = parts[1];
    const fracNumerator = BigInt(fracStr);
    const fracDenominator = 10n ** BigInt(fracStr.length);
    // lo = (fracNumerator * 2^64) / fracDenominator
    const lo = (fracNumerator * Q64_ONE) / fracDenominator;
    return { hi, lo };
}
/**
 * Formats basis points into human-readable percentage string (e.g. 150 -> "1.50%").
 */
export function formatBps(bps) {
    return `${(bps / 100).toFixed(2)}%`;
}
//# sourceMappingURL=math.js.map