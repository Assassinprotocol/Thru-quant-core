#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <assert.h>
#include "thru_math.h"

/* Simple deterministic 64-bit XorShift PRNG (avoids libc rand variation across OS) */
static uint64_t prng_state = 0x853c49e6748fea9bULL;

static uint64_t next_u64(void) {
    uint64_t x = prng_state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    prng_state = x;
    return x;
}

static double q64_to_double(q64_t x) {
    if (x >= 0) {
        return (double)x / (double)Q64_ONE;
    } else {
        uq64_t ux = (uq64_t)0 - (uq64_t)x;
        return -(double)ux / (double)Q64_ONE;
    }
}

static q64_t double_to_q64(double d) {
    if (d >= 0.0) {
        return (q64_t)(d * (double)Q64_ONE);
    } else {
        return -(q64_t)((-d) * (double)Q64_ONE);
    }
}

int main(int argc, char **argv) {
    int iterations = 200000;
    if (argc > 1) {
        iterations = atoi(argv[1]);
        if (iterations <= 0) iterations = 200000;
    }

    int tested_ops = 0;
    double max_rel_err_exp = 0.0;
    double max_rel_err_ln = 0.0;
    double max_rel_err_sqrt = 0.0;

    for (int i = 0; i < iterations; i++) {
        uint64_t r1 = next_u64();
        uint64_t r2 = next_u64();

        /* --- 1. Test q64_div_checked & Zero Div --- */
        if (i % 500 == 0) {
            /* Zero div check */
            q64_t out = 0;
            q64_status_t st = q64_div_checked((q64_t)r1, 0, &out);
            assert(st == Q64_ERR_DIV_BY_ZERO);
        } else {
            /* Safe normalized division */
            double d1 = ((double)(r1 % 10000000) / 1000.0) + 0.01;
            double d2 = ((double)(r2 % 10000000) / 1000.0) + 0.01;
            q64_t q1 = double_to_q64(d1);
            q64_t q2 = double_to_q64(d2);
            q64_t q_out = 0;
            q64_status_t st = q64_div_checked(q1, q2, &q_out);
            if (st == Q64_OK) {
                double diff = fabs(q64_to_double(q_out) - (d1 / d2));
                double rel = diff / (d1 / d2);
                assert(rel < 1e-9);
            }
        }

        /* --- 2. Test q64_sqrt_checked --- */
        if (i % 200 == 0) {
            /* Negative input domain check */
            q64_t out = 0;
            q64_status_t st = q64_sqrt_checked(-((q64_t)(r1 % 10000 + 1) * Q64_ONE), &out);
            assert(st == Q64_ERR_DOMAIN);
        } else {
            /* Normalized non-negative sqrt */
            double d = (double)(r1 % 50000000) / 1000.0;
            q64_t q = double_to_q64(d);
            q64_t q_out = 0;
            q64_status_t st = q64_sqrt_checked(q, &q_out);
            assert(st == Q64_OK);
            double expected = sqrt(d);
            if (expected > 1e-6) {
                double diff = fabs(q64_to_double(q_out) - expected);
                double rel = diff / expected;
                if (rel > max_rel_err_sqrt) max_rel_err_sqrt = rel;
                assert(rel < 1e-7);
            }
        }

        /* --- 3. Test q64_exp_checked --- */
        double d_exp = ((double)(int64_t)(r1 % 60000) / 1000.0) - 20.0; /* [-20.0, 40.0] */
        q64_t q_exp = double_to_q64(d_exp);
        q64_t q_exp_out = 0;
        q64_status_t st_exp = q64_exp_checked(q_exp, &q_exp_out);
        if (d_exp > 43.0) {
            assert(st_exp == Q64_ERR_OVERFLOW);
        } else if (d_exp < -45.0) {
            assert(st_exp == Q64_ERR_UNDERFLOW);
        } else {
            assert(st_exp == Q64_OK);
            double expected = exp(d_exp);
            double diff = fabs(q64_to_double(q_exp_out) - expected);
            double rel = diff / expected;
            if (rel > max_rel_err_exp) max_rel_err_exp = rel;
            assert(rel < 1e-7);
        }

        /* --- 4. Test q64_ln_checked --- */
        if (i % 200 == 0) {
            /* Zero / Negative ln domain check */
            q64_t out = 0;
            assert(q64_ln_checked(0, &out) == Q64_ERR_DOMAIN);
            assert(q64_ln_checked(-Q64_ONE, &out) == Q64_ERR_DOMAIN);
        } else {
            double d_ln = ((double)(r2 % 100000000) / 1000.0) + 0.001; /* [0.001, 100000.0] */
            q64_t q_ln = double_to_q64(d_ln);
            q64_t q_ln_out = 0;
            q64_status_t st_ln = q64_ln_checked(q_ln, &q_ln_out);
            assert(st_ln == Q64_OK);
            double expected = log(d_ln);
            double diff = fabs(q64_to_double(q_ln_out) - expected);
            double rel = diff / (fabs(expected) + 1.0);
            if (rel > max_rel_err_ln) max_rel_err_ln = rel;
            assert(rel < 1e-7);
        }

        tested_ops += 4;
    }

    printf("fuzz_math_diff: %d differential iterations (%d operations) PASSED\n", iterations, tested_ops);
    printf("  max relative errors: sqrt=%.2e, exp=%.2e, ln=%.2e\n", max_rel_err_sqrt, max_rel_err_exp, max_rel_err_ln);
    return 0;
}
