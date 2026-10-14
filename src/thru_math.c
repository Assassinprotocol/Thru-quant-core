#include "thru_math.h"

q64_t q64_from_ratio(int64_t numerator, int64_t denominator) {
    if (denominator == 0) return 0;
    bool neg = (numerator < 0) ^ (denominator < 0);
    uint64_t u_num = (numerator == INT64_MIN) ? (1ULL << 63) : (uint64_t)(numerator < 0 ? -numerator : numerator);
    uint64_t u_den = (denominator == INT64_MIN) ? (1ULL << 63) : (uint64_t)(denominator < 0 ? -denominator : denominator);

    uq64_t shifted = ((uq64_t)u_num) << Q64_SCALE_BITS;
    uq64_t res = shifted / (uq64_t)u_den;
    return neg ? (q64_t)((uq64_t)0 - res) : (q64_t)res;
}

q64_t q64_mul(q64_t a, q64_t b) {
    if (a == 0 || b == 0) return 0;
    bool neg = (a < 0) ^ (b < 0);
    uq64_t ua = (a < 0) ? ((uq64_t)0 - (uq64_t)a) : (uq64_t)a;
    uq64_t ub = (b < 0) ? ((uq64_t)0 - (uq64_t)b) : (uq64_t)b;

    uint64_t a_hi = (uint64_t)(ua >> 64);
    uint64_t a_lo = (uint64_t)ua;
    uint64_t b_hi = (uint64_t)(ub >> 64);
    uint64_t b_lo = (uint64_t)ub;

    uq64_t p0 = (uq64_t)a_lo * b_lo;
    uq64_t p1 = (uq64_t)a_lo * b_hi;
    uq64_t p2 = (uq64_t)a_hi * b_lo;
    uq64_t p3 = (uq64_t)a_hi * b_hi;

    /* If product of integer components exceeds 63 bits, it overflows Q64.64 */
    if (p3 >= ((uq64_t)1 << 63)) {
        return neg ? Q64_MIN : Q64_MAX;
    }

    uq64_t mid = p1 + p2 + (p0 >> 64);
    if (mid < p1) {
        return neg ? Q64_MIN : Q64_MAX;
    }

    uq64_t hi_part = (p3 << 64);
    uq64_t result = hi_part + mid;
    if (result < hi_part || (result >> 127) > 0) {
        return neg ? Q64_MIN : Q64_MAX;
    }
    return neg ? (q64_t)((uq64_t)0 - result) : (q64_t)result;
}

q64_t q64_div(q64_t a, q64_t b) {
    if (b == 0) return 0;
    bool neg = (a < 0) ^ (b < 0);
    uq64_t ua = (a < 0) ? ((uq64_t)0 - (uq64_t)a) : (uq64_t)a;
    uq64_t ub = (b < 0) ? ((uq64_t)0 - (uq64_t)b) : (uq64_t)b;

    /* Identity: ua = (q_int * ub) + rem */
    uq64_t q_int = ua / ub;
    uq64_t rem = ua % ub;

    /* Overflow check: integer part exceeds signed 63-bit range */
    if (q_int >= ((uq64_t)1 << 63)) {
        return neg ? Q64_MIN : Q64_MAX;
    }

    /* Compute fractional part: (rem * 2^64) / ub */
    uq64_t frac = 0;
    if (ub < ((uq64_t)1 << 64)) {
        /* If ub < 2^64, rem * 2^64 cannot overflow 128-bit integer */
        frac = (rem << 64) / ub;
    } else {
        /* Bit-by-bit restoring division for 64 fractional bits */
        for (int i = 0; i < 64; i++) {
            rem <<= 1;
            frac <<= 1;
            if (rem >= ub) {
                rem -= ub;
                frac |= 1;
            }
        }
    }

    uq64_t result = (q_int << 64) | frac;
    return neg ? (q64_t)((uq64_t)0 - result) : (q64_t)result;
}

q64_t q64_sqrt(q64_t x) {
    if (x <= 0) return 0;

    uq64_t ux = (uq64_t)x;
    int bit_len = 0;
    uq64_t tmp = ux;
    while (tmp > 0) {
        bit_len++;
        tmp >>= 1;
    }

    /* Initial guess: 1 << ((bit_len + 64) / 2) */
    q64_t y = (q64_t)1 << ((bit_len + 64) / 2);

    /* Newton-Raphson iterations: y_{k+1} = (y_k + x/y_k) / 2 */
    for (int i = 0; i < 16; i++) {
        q64_t div = q64_div(x, y);
        q64_t y_next = (y + div) >> 1;
        if (y_next == y || y_next == y - 1 || y_next == y + 1) {
            y = y_next;
            break;
        }
        y = y_next;
    }

    return y;
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
