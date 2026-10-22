#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include "aggregation_math.h"
#include "golden_v2_vectors.h"

int main(void) {
    for (uint32_t i = 0; i < GOLDEN_V2_CASES_COUNT; i++) {
        const golden_v2_case_t *c = &GOLDEN_V2_CASES[i];
        aggregation_output_t out = aggregate_symbol_quotes(
            c->quotes,
            c->quote_count,
            3,
            c->outlier_bps,
            c->big_move_bps,
            c->prev_price
        );

        assert(out.success == c->expected.success);
        assert(out.price == c->expected.price);
        assert(out.confidence_bps == c->expected.confidence_bps);
        assert(out.contributor_count == c->expected.contributor_count);
        assert(out.flags == c->expected.flags);

        printf("  [PASS] Golden vector '%s': price=%lu conf=%lu flags=0x%02x\n",
               c->name, out.price, out.confidence_bps, out.flags);
    }

    return 0;
}
