#ifndef THRU_MATH_H
#define THRU_MATH_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef __int128_t  q64_t;
typedef __uint128_t uq64_t;

#define Q64_SCALE_BITS        64
#define Q64_ONE               (((q64_t)1) << Q64_SCALE_BITS)
#define Q64_HALF              (((q64_t)1) << (Q64_SCALE_BITS - 1))
#define Q64_ZERO              ((q64_t)0)
#define Q64_MAX               ((((q64_t)1) << 126) - 1 + (((q64_t)1) << 126))
#define Q64_MIN               (-Q64_MAX - 1)

#define Q64_PI                ((((q64_t)3) << Q64_SCALE_BITS) | ((q64_t)0x243F6A8885A308D3ULL))
#define Q64_E                 ((((q64_t)2) << Q64_SCALE_BITS) | ((q64_t)0xB7E151628AED2A6BULL))
#define Q64_LN2               ((q64_t)0xB17217F7D1CF79ABULL)

/* Core lightweight operations */
static inline q64_t q64_from_int(int64_t x) {
    if (x >= 0) {
        return ((q64_t)x) << Q64_SCALE_BITS;
    } else {
        uint64_t u_mag = (x == INT64_MIN) ? (1ULL << 63) : (uint64_t)(-x);
        uq64_t scaled = ((uq64_t)u_mag) << Q64_SCALE_BITS;
        return (q64_t)((uq64_t)0 - scaled);
    }
}

static inline int64_t q64_to_int(q64_t x) {
    if (x >= 0) {
        return (int64_t)(x >> Q64_SCALE_BITS);
    } else {
        uq64_t ux = (uq64_t)0 - (uq64_t)x;
        uint64_t int_part = (uint64_t)(ux >> Q64_SCALE_BITS);
        return (int_part == (1ULL << 63)) ? INT64_MIN : -(int64_t)int_part;
    }
}

static inline q64_t q64_abs(q64_t x) {
    return (x < 0) ? -x : x;
}

static inline q64_t q64_add(q64_t a, q64_t b) {
    return a + b;
}

static inline q64_t q64_sub(q64_t a, q64_t b) {
    return a - b;
}

static inline q64_t q64_min(q64_t a, q64_t b) {
    return (a < b) ? a : b;
}

static inline q64_t q64_max(q64_t a, q64_t b) {
    return (a > b) ? a : b;
}

/* Functions implemented in thru_math.c */
q64_t q64_from_ratio(int64_t num, int64_t den);
q64_t q64_mul(q64_t a, q64_t b);
q64_t q64_div(q64_t a, q64_t b);
q64_t q64_sqrt(q64_t x);
q64_t q64_exp(q64_t x);
q64_t q64_ln(q64_t x);

#ifdef __cplusplus
}
#endif

#endif /* THRU_MATH_H */
