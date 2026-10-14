#include <stdio.h>
#include <assert.h>
#include "thru_math.h"

int main() {
    printf("[TEST] Testing thru_math Q64.64...\n");

    /* 1. Conversions & Negative Numbers */
    q64_t val = q64_from_int(42);
    assert(q64_to_int(val) == 42);

    q64_t neg_val = q64_from_int(-42);
    assert(q64_to_int(neg_val) == -42);

    q64_t min_int64 = q64_from_int(INT64_MIN);
    assert(q64_to_int(min_int64) == INT64_MIN);

    q64_t max_int64 = q64_from_int(INT64_MAX);
    assert(q64_to_int(max_int64) == INT64_MAX);

    /* 2. Ratio (1.5, -1.5, signs) */
    q64_t one_half = q64_from_ratio(3, 2);
    assert(q64_to_int(one_half) == 1);

    q64_t neg_one_half = q64_from_ratio(-3, 2);
    assert(q64_to_int(neg_one_half) == -1);

    q64_t neg_one_half2 = q64_from_ratio(3, -2);
    assert(q64_to_int(neg_one_half2) == -1);

    q64_t pos_one_half2 = q64_from_ratio(-3, -2);
    assert(q64_to_int(pos_one_half2) == 1);

    /* 3. Addition and Subtraction */
    q64_t a = q64_from_int(10);
    q64_t b = q64_from_int(20);
    assert(q64_to_int(q64_add(a, b)) == 30);
    assert(q64_to_int(q64_sub(b, a)) == 10);
    assert(q64_to_int(q64_add(neg_val, val)) == 0);

    /* 4. Multiplication & Negative / Overflow Handling */
    q64_t two = q64_from_int(2);
    q64_t three = q64_mul(one_half, two);
    assert(q64_to_int(three) == 3);
    assert(q64_to_int(q64_mul(q64_from_int(-5), q64_from_int(4))) == -20);
    assert(q64_to_int(q64_mul(q64_from_int(-5), q64_from_int(-4))) == 20);

    /* 4b. Overflow Saturation */
    q64_t huge_a = q64_from_int(1000000000000LL);
    q64_t huge_b = q64_from_int(1000000000000LL);
    assert(q64_mul(huge_a, huge_b) == Q64_MAX);
    assert(q64_mul(-huge_a, huge_b) == Q64_MIN);

    /* 5. Division (10 / 4 = 2.5) */
    q64_t ten = q64_from_int(10);
    q64_t four = q64_from_int(4);
    q64_t two_half = q64_div(ten, four);
    assert(q64_to_int(two_half) == 2);
    assert(q64_to_int(q64_mul(two_half, two)) == 5);

    /* 5b. Large Value & Crypto Price Division */
    q64_t btc_price = q64_from_int(65000);
    q64_t eth_price = q64_from_int(3250);
    q64_t btc_eth_ratio = q64_div(btc_price, eth_price);
    assert(q64_to_int(btc_eth_ratio) == 20);

    /* 5c. Fractional Division & Negative Division */
    q64_t neg_ten = q64_from_int(-10);
    assert(q64_to_int(q64_div(neg_ten, two)) == -5);
    assert(q64_to_int(q64_div(ten, -two)) == -5);
    assert(q64_to_int(q64_div(neg_ten, -two)) == 5);
    assert(q64_div(ten, 0) == 0);

    /* 6. Square Root */
    q64_t nine = q64_from_int(9);
    q64_t sqrt_nine = q64_sqrt(nine);
    assert(q64_to_int(sqrt_nine) == 3);

    q64_t hundred = q64_from_int(100);
    assert(q64_to_int(q64_sqrt(hundred)) == 10);

    /* 7. Exponential */
    q64_t exp_zero = q64_exp(0);
    assert(q64_to_int(exp_zero) == 1);

    q64_t exp_one = q64_exp(Q64_ONE);
    assert(q64_to_int(exp_one) == 2); /* e = 2.718... */

    /* 8. Logarithm */
    q64_t ln_one = q64_ln(Q64_ONE);
    assert(q64_abs(ln_one) < 1000); /* ~0 */

    printf("[SUCCESS] All thru_math Q64.64 unit tests passed successfully!\n");
    return 0;
}
