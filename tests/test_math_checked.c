#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include "thru_math.h"

static void test_checked_from_ratio(void) {
    q64_t out = 0;
    q64_status_t st;

    st = q64_from_ratio_checked(10, 2, &out);
    assert(st == Q64_OK);
    assert(out == 5 * Q64_ONE);

    st = q64_from_ratio_checked(10, 0, &out);
    assert(st == Q64_ERR_DIV_BY_ZERO);

    st = q64_from_ratio_checked(INT64_MAX, 1, &out);
    assert(st == Q64_OK);
}

static void test_checked_mul(void) {
    q64_t out = 0;
    q64_status_t st;

    /* 2.5 * 4.0 = 10.0 */
    q64_t a = (q64_t)(2.5 * (double)Q64_ONE);
    q64_t b = 4 * Q64_ONE;
    st = q64_mul_checked(a, b, &out);
    assert(st == Q64_OK);
    assert(out == 10 * Q64_ONE);

    /* Zero multiplication */
    st = q64_mul_checked(a, 0, &out);
    assert(st == Q64_OK);
    assert(out == 0);

    /* Extreme overflow */
    q64_t huge = ((q64_t)1 << 100);
    st = q64_mul_checked(huge, huge, &out);
    assert(st == Q64_ERR_OVERFLOW);
}

static void test_checked_div(void) {
    q64_t out = 0;
    q64_status_t st;

    /* 10.0 / 2.0 = 5.0 */
    st = q64_div_checked(10 * Q64_ONE, 2 * Q64_ONE, &out);
    assert(st == Q64_OK);
    assert(out == 5 * Q64_ONE);

    /* Div by zero */
    st = q64_div_checked(10 * Q64_ONE, 0, &out);
    assert(st == Q64_ERR_DIV_BY_ZERO);

    /* Overflow division: large / tiny */
    q64_t tiny = 1; /* 2^-64 */
    st = q64_div_checked(10 * Q64_ONE, tiny, &out);
    assert(st == Q64_ERR_OVERFLOW);
}

static void test_checked_sqrt(void) {
    q64_t out = 0;
    q64_status_t st;

    /* sqrt(16.0) = 4.0 */
    st = q64_sqrt_checked(16 * Q64_ONE, &out);
    assert(st == Q64_OK);
    assert(out == 4 * Q64_ONE);

    /* sqrt(0) = 0 */
    st = q64_sqrt_checked(0, &out);
    assert(st == Q64_OK);
    assert(out == 0);

    /* sqrt(-1) = DOMAIN_ERROR */
    st = q64_sqrt_checked(-Q64_ONE, &out);
    assert(st == Q64_ERR_DOMAIN);
}

static void test_checked_exp(void) {
    q64_t out = 0;
    q64_status_t st;

    /* exp(0) = 1 */
    st = q64_exp_checked(0, &out);
    assert(st == Q64_OK);
    assert(out == Q64_ONE);

    /* exp(1) approx E */
    st = q64_exp_checked(Q64_ONE, &out);
    assert(st == Q64_OK);
    q64_t diff = q64_abs(out - Q64_E);
    assert(diff < 1000); /* High precision */

    /* exp(50) = OVERFLOW */
    st = q64_exp_checked(50 * Q64_ONE, &out);
    assert(st == Q64_ERR_OVERFLOW);

    /* exp(-50) = UNDERFLOW */
    st = q64_exp_checked(-50 * Q64_ONE, &out);
    assert(st == Q64_ERR_UNDERFLOW);
    assert(out == 0);
}

static void test_checked_ln(void) {
    q64_t out = 0;
    q64_status_t st;

    /* ln(1) = 0 */
    st = q64_ln_checked(Q64_ONE, &out);
    assert(st == Q64_OK);
    assert(out == 0);

    /* ln(E) approx 1 */
    st = q64_ln_checked(Q64_E, &out);
    assert(st == Q64_OK);
    q64_t diff = q64_abs(out - Q64_ONE);
    assert(diff < 1000);

    /* ln(0) = DOMAIN_ERROR */
    st = q64_ln_checked(0, &out);
    assert(st == Q64_ERR_DOMAIN);

    /* ln(-5) = DOMAIN_ERROR */
    st = q64_ln_checked(-5 * Q64_ONE, &out);
    assert(st == Q64_ERR_DOMAIN);
}

int main(void) {
    test_checked_from_ratio();
    test_checked_mul();
    test_checked_div();
    test_checked_sqrt();
    test_checked_exp();
    test_checked_ln();
    printf("test_math_checked: ALL CHECKED MATH TESTS PASSED\n");
    return 0;
}
