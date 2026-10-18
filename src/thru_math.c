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

/* ---- Transcendentals (Phase 7: range-reduced, measured against a 113-bit reference) ------------
 * exp : x = k*ln2 + r, |r| <= ~0.3466; degree-16 Taylor on r (Horner, precomputed 1/n!); result 2^k * e^r.
 * ln  : x = m*2^e with m in (0.7071, 1.4142]; ln m = 2*atanh((m-1)/(m+1)), |y| <= 0.1716, 13 odd terms.
 * Domain: exp(x) = Q64_MAX for x > 43, 0 for x < -45. ln(x <= 0) = Q64_MIN (sentinel, see PHASE7 P1-M2).
 * Constants are compile-time (no runtime division). ln2 uses a 128-bit constant so k*ln2 does not
 * amplify the 64-bit truncation error. */
#define LN2_HI    0xB17217F7D1CF79ABULL
#define LN2_LO    0xC9E3B39803F2F6AFULL
#define LOG2E_Q64 ((((uq64_t)1) << 64) | (uq64_t)0x71547652B82FE177ULL)
#define SQRT2_Q64 ((((uq64_t)1) << 64) | (uq64_t)0x6A09E667F3BCC908ULL)
#define QRECIP(n) ((q64_t)((((uq64_t)1) << 64) / (uq64_t)(n)))

static const q64_t EXP_C[17] = {
    QRECIP(1), QRECIP(1), QRECIP(2), QRECIP(6), QRECIP(24), QRECIP(120), QRECIP(720), QRECIP(5040),
    QRECIP(40320), QRECIP(362880), QRECIP(3628800), QRECIP(39916800ULL), QRECIP(479001600ULL),
    QRECIP(6227020800ULL), QRECIP(87178291200ULL), QRECIP(1307674368000ULL), QRECIP(20922789888000ULL)
};
static const q64_t LN_C[13] = {
    QRECIP(1), QRECIP(3), QRECIP(5), QRECIP(7), QRECIP(9), QRECIP(11), QRECIP(13),
    QRECIP(15), QRECIP(17), QRECIP(19), QRECIP(21), QRECIP(23), QRECIP(25)
};

static q64_t q64_mul_ln2_int(int64_t k) {
    uint64_t a = (k < 0) ? (uint64_t)(-(k + 1)) + 1ULL : (uint64_t)k;
    uq64_t v = (uq64_t)a * LN2_HI + (((uq64_t)a * LN2_LO) >> 64);
    return (k < 0) ? (q64_t)((uq64_t)0 - v) : (q64_t)v;
}

q64_t q64_exp(q64_t x) {
    if (x == 0) return Q64_ONE;
    if (x < -((q64_t)45 << 64)) return 0;
    if (x > ((q64_t)43 << 64)) return Q64_MAX;

    q64_t kq = q64_mul(x, (q64_t)LOG2E_Q64);
    int64_t k = q64_to_int(kq + ((x >= 0) ? Q64_HALF : -Q64_HALF));
    q64_t r = x - q64_mul_ln2_int(k);

    q64_t p = EXP_C[16];
    for (int n = 15; n >= 0; n--) p = EXP_C[n] + q64_mul(r, p);

    if (k >= 0) {
        if (k > 62 || p > (Q64_MAX >> k)) return Q64_MAX;
        return p << k;
    }
    if (k < -127) return 0;
    return p >> (-k);
}

q64_t q64_ln(q64_t x) {
    if (x <= 0) return Q64_MIN;
    uq64_t ux = (uq64_t)x;
    uint64_t hi = (uint64_t)(ux >> 64), lo = (uint64_t)ux;
    int msb = hi ? (127 - __builtin_clzll(hi)) : (63 - __builtin_clzll(lo));
    int e = msb - 64;
    uq64_t m = (e >= 0) ? (ux >> e) : (ux << (-e));
    if (m > SQRT2_Q64) { m >>= 1; e += 1; }

    q64_t mm = (q64_t)m;
    q64_t y = q64_div(mm - Q64_ONE, mm + Q64_ONE);
    q64_t y2 = q64_mul(y, y);
    q64_t p = LN_C[12];
    for (int k = 11; k >= 0; k--) p = LN_C[k] + q64_mul(y2, p);
    return 2 * q64_mul(y, p) + q64_mul_ln2_int(e);
}

/* =========================================================================
 * Checked Mathematical Functions (M2)
 * ========================================================================= */

q64_status_t q64_from_ratio_checked(int64_t num, int64_t den, q64_t *out) {
    if (den == 0) return Q64_ERR_DIV_BY_ZERO;
    bool neg = (num < 0) ^ (den < 0);
    uint64_t u_num = (num == INT64_MIN) ? (1ULL << 63) : (uint64_t)(num < 0 ? -num : num);
    uint64_t u_den = (den == INT64_MIN) ? (1ULL << 63) : (uint64_t)(den < 0 ? -den : den);

    uint64_t q_int = u_num / u_den;
    if (q_int >= (1ULL << 63)) {
        return Q64_ERR_OVERFLOW;
    }

    uq64_t shifted = ((uq64_t)u_num) << Q64_SCALE_BITS;
    uq64_t res = shifted / (uq64_t)u_den;
    if (out) {
        *out = neg ? (q64_t)((uq64_t)0 - res) : (q64_t)res;
    }
    return Q64_OK;
}

q64_status_t q64_mul_checked(q64_t a, q64_t b, q64_t *out) {
    if (a == 0 || b == 0) {
        if (out) *out = 0;
        return Q64_OK;
    }

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

    if (p3 >= ((uq64_t)1 << 63)) {
        return Q64_ERR_OVERFLOW;
    }

    uq64_t mid = p1 + p2 + (p0 >> 64);
    if (mid < p1) {
        return Q64_ERR_OVERFLOW;
    }

    uq64_t hi_part = (p3 << 64);
    uq64_t result = hi_part + mid;
    if (result < hi_part || (result >> 127) > 0) {
        return Q64_ERR_OVERFLOW;
    }

    if (out) {
        *out = neg ? (q64_t)((uq64_t)0 - result) : (q64_t)result;
    }
    return Q64_OK;
}

q64_status_t q64_div_checked(q64_t a, q64_t b, q64_t *out) {
    if (b == 0) return Q64_ERR_DIV_BY_ZERO;
    if (a == 0) {
        if (out) *out = 0;
        return Q64_OK;
    }

    bool neg = (a < 0) ^ (b < 0);
    uq64_t ua = (a < 0) ? ((uq64_t)0 - (uq64_t)a) : (uq64_t)a;
    uq64_t ub = (b < 0) ? ((uq64_t)0 - (uq64_t)b) : (uq64_t)b;

    uq64_t q_int = ua / ub;
    if (q_int >= ((uq64_t)1 << 63)) {
        return Q64_ERR_OVERFLOW;
    }

    uq64_t rem = ua % ub;
    uq64_t frac = 0;
    if (ub < ((uq64_t)1 << 64)) {
        frac = (rem << 64) / ub;
    } else {
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
    if (out) {
        *out = neg ? (q64_t)((uq64_t)0 - result) : (q64_t)result;
    }
    return Q64_OK;
}

q64_status_t q64_sqrt_checked(q64_t x, q64_t *out) {
    if (x < 0) return Q64_ERR_DOMAIN;
    if (x == 0) {
        if (out) *out = 0;
        return Q64_OK;
    }
    if (out) {
        *out = q64_sqrt(x);
    }
    return Q64_OK;
}

q64_status_t q64_exp_checked(q64_t x, q64_t *out) {
    if (x > ((q64_t)43 << 64)) return Q64_ERR_OVERFLOW;
    if (x < -((q64_t)45 << 64)) {
        if (out) *out = 0;
        return Q64_ERR_UNDERFLOW;
    }
    if (out) {
        *out = q64_exp(x);
    }
    return Q64_OK;
}

q64_status_t q64_ln_checked(q64_t x, q64_t *out) {
    if (x <= 0) return Q64_ERR_DOMAIN;
    if (out) {
        *out = q64_ln(x);
    }
    return Q64_OK;
}
