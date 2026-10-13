#include <stdio.h>
#include <assert.h>
#include "thru_math.h"

int main() {
    printf("[TEST] Testing thru_math Q64.64...\n");

    /* 1. Conversions */
    q64_t val = q64_from_int(42);
    assert(q64_to_int(val) == 42);

    /* 2. Ratio (1.5) */
    q64_t one_half = q64_from_ratio(3, 2);
    assert(q64_to_int(one_half) == 1);

    /* 3. Addition and Subtraction */
    q64_t a = q64_from_int(10);
    q64_t b = q64_from_int(20);
    assert(q64_to_int(q64_add(a, b)) == 30);
    assert(q64_to_int(q64_sub(b, a)) == 10);

    /* 4. Multiplication */
    q64_t two = q64_from_int(2);
    q64_t three = q64_mul(one_half, two);
    assert(q64_to_int(three) == 3);

    /* 5. Division (10 / 4 = 2.5) */
    q64_t ten = q64_from_int(10);
    q64_t four = q64_from_int(4);
    q64_t two_half = q64_div(ten, four);
    assert(q64_to_int(two_half) == 2);
    assert(q64_to_int(q64_mul(two_half, two)) == 5);

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
