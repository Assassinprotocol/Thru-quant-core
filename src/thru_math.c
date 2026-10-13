#include "thru_math.h"

q64_t q64_from_ratio(int64_t numerator, int64_t denominator) {
    if (denominator == 0) return 0;
    q64_t num = ((q64_t)numerator) << Q64_SCALE_BITS;
    return num / (q64_t)denominator;
}

q64_t q64_mul(q64_t a, q64_t b) {
    bool neg = (a < 0) ^ (b < 0);
    uq64_t ua = (a < 0) ? (uq64_t)(-a) : (uq64_t)a;
    uq64_t ub = (b < 0) ? (uq64_t)(-b) : (uq64_t)b;

    uint64_t a_hi = (uint64_t)(ua >> 64);
    uint64_t a_lo = (uint64_t)ua;
    uint64_t b_hi = (uint64_t)(ub >> 64);
    uint64_t b_lo = (uint64_t)ub;

    uq64_t p0 = (uq64_t)a_lo * b_lo;
    uq64_t p1 = (uq64_t)a_lo * b_hi;
    uq64_t p2 = (uq64_t)a_hi * b_lo;
    uq64_t p3 = (uq64_t)a_hi * b_hi;

    uq64_t result = (p3 << 64) + p1 + p2 + (p0 >> 64);
    return neg ? -(q64_t)result : (q64_t)result;
}

q64_t q64_div(q64_t a, q64_t b) {
    if (b == 0) return 0;
    bool neg = (a < 0) ^ (b < 0);
    uq64_t ua = (a < 0) ? (uq64_t)(-a) : (uq64_t)a;
    uq64_t ub = (b < 0) ? (uq64_t)(-b) : (uq64_t)b;

    uq64_t quotient = (ua << 64) / ub;
    return neg ? -(q64_t)quotient : (q64_t)quotient;
}

q64_t q64_sqrt(q64_t x) {
    if (x <= 0) return 0;
    uq64_t val = (uq64_t)x;
    uq64_t res = 0;
    uq64_t one = (uq64_t)1 << 126;

    while (one > (val << 64)) {
        one >>= 2;
    }

    uq64_t shifted_val = val << 64;
    while (one != 0) {
        if (shifted_val >= res + one) {
            shifted_val -= res + one;
            res = (res >> 1) + one;
        } else {
            res >>= 1;
        }
        one >>= 2;
    }

    return (q64_t)res;
}

q64_t q64_exp(q64_t x) {
    if (x == 0) return Q64_ONE;
    if (x < -((q64_t)45 << 64)) return 0;
    if (x > ((q64_t)45 << 64)) return Q64_MAX;

    bool neg = (x < 0);
    if (neg) x = -x;

    int64_t integer_part = q64_to_int(x);
    q64_t frac = x - q64_from_int(integer_part);

    q64_t sum = Q64_ONE;
    q64_t term = frac;
    sum += term;

    term = q64_mul(term, frac) / 2;
    sum += term;

    term = q64_mul(term, frac) / 3;
    sum += term;

    term = q64_mul(term, frac) / 4;
    sum += term;

    term = q64_mul(term, frac) / 5;
    sum += term;

    term = q64_mul(term, frac) / 6;
    sum += term;

    q64_t e_int = Q64_ONE;
    q64_t e_base = Q64_E;
    while (integer_part > 0) {
        if (integer_part & 1) {
            e_int = q64_mul(e_int, e_base);
        }
        e_base = q64_mul(e_base, e_base);
        integer_part >>= 1;
    }

    q64_t result = q64_mul(sum, e_int);
    return neg ? q64_div(Q64_ONE, result) : result;
}

q64_t q64_ln(q64_t x) {
    if (x <= 0) return Q64_MIN;
    if (x == Q64_ONE) return 0;

    uq64_t val = (uq64_t)x;
    int lz = 0;
    uint64_t hi = (uint64_t)(val >> 64);
    uint64_t lo = (uint64_t)val;
    if (hi != 0) {
        lz = __builtin_clzll(hi);
    } else {
        lz = 64 + __builtin_clzll(lo);
    }

    int shift = 63 - (127 - lz);
    q64_t norm = (shift >= 0) ? (x << shift) : (x >> -shift);

    q64_t y = q64_div(norm - Q64_ONE, norm + Q64_ONE);
    q64_t y2 = q64_mul(y, y);
    q64_t term = y;
    q64_t sum = term;

    term = q64_mul(term, y2);
    sum += term / 3;

    term = q64_mul(term, y2);
    sum += term / 5;

    term = q64_mul(term, y2);
    sum += term / 7;

    sum = sum * 2;
    q64_t shift_ln2 = q64_mul(q64_from_int(-shift), Q64_LN2);
    return sum + shift_ln2;
}
