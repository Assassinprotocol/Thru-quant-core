#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include "aggregation_math.h"

static void test_quorum_insufficient(void) {
    quote_entry_t q[2] = {
        {8400000000000ULL, 1700000000},
        {8401000000000ULL, 1700000001}
    };
    aggregation_output_t out = aggregate_symbol_quotes(q, 2, 3, 100, 300, 8400000000000ULL);
    assert(!out.success);
    assert((out.flags & FEED_FLAG_STALE) != 0);
    printf("  [PASS] I-12: Insufficient quorum returns failure\n");
}

static void test_normal_consensus(void) {
    quote_entry_t q[5] = {
        {8400000000000ULL, 1700000000},
        {8402000000000ULL, 1700000001},
        {8401000000000ULL, 1700000000},
        {8400500000000ULL, 1700000001},
        {8401500000000ULL, 1700000000}
    };
    aggregation_output_t out = aggregate_symbol_quotes(q, 5, 3, 100, 300, 8400000000000ULL);
    assert(out.success);
    assert(out.contributor_count == 5);
    assert(out.price == 8401000000000ULL);
    assert(out.flags == 0);
    printf("  [PASS] I-13: Consensus median matches expected value\n");
}

static void test_outlier_filtering(void) {
    quote_entry_t q[5] = {
        {8400000000000ULL, 1700000000},
        {8401000000000ULL, 1700000001},
        {8400500000000ULL, 1700000000},
        {8401500000000ULL, 1700000001},
        {8600000000000ULL, 1700000000}
    };
    aggregation_output_t out = aggregate_symbol_quotes(q, 5, 3, 100, 300, 8400000000000ULL);
    assert(out.success);
    assert(out.contributor_count == 4);
    assert((out.flags & FEED_FLAG_OUTLIER_REJECTED) != 0);
    assert(out.price == 8400750000000ULL);
    printf("  [PASS] I-15: Outlier dropped and flag set\n");
}

static void test_no_consensus_after_outliers(void) {
    quote_entry_t q[3] = {
        {8400000000000ULL, 1700000000},
        {8401000000000ULL, 1700000001},
        {8700000000000ULL, 1700000000}
    };
    aggregation_output_t out = aggregate_symbol_quotes(q, 3, 3, 100, 300, 8400000000000ULL);
    assert(!out.success);
    assert((out.flags & FEED_FLAG_LOW_CONFIDENCE) != 0);
    printf("  [PASS] I-16: Post-filter quorum failure sets NO_CONSENSUS\n");
}

static void test_big_move_flag(void) {
    quote_entry_t q[3] = {
        {9000000000000ULL, 1700000000},
        {9005000000000ULL, 1700000001},
        {9002000000000ULL, 1700000000}
    };
    aggregation_output_t out = aggregate_symbol_quotes(q, 3, 3, 100, 300, 8400000000000ULL);
    assert(out.success);
    assert((out.flags & FEED_FLAG_BIG_MOVE) != 0);
    printf("  [PASS] I-30: BIG_MOVE flag set without aborting commit\n");
}

static void test_permutation_invariance(void) {
    quote_entry_t q1[4] = {
        {8400000000000ULL, 1},
        {8402000000000ULL, 2},
        {8401000000000ULL, 3},
        {8403000000000ULL, 4}
    };
    quote_entry_t q2[4] = {
        {8403000000000ULL, 4},
        {8400000000000ULL, 1},
        {8402000000000ULL, 2},
        {8401000000000ULL, 3}
    };
    aggregation_output_t out1 = aggregate_symbol_quotes(q1, 4, 3, 100, 300, 8400000000000ULL);
    aggregation_output_t out2 = aggregate_symbol_quotes(q2, 4, 3, 100, 300, 8400000000000ULL);
    assert(out1.success && out2.success);
    assert(out1.price == out2.price);
    assert(out1.confidence_bps == out2.confidence_bps);
    assert(out1.flags == out2.flags);
    printf("  [PASS] I-14: Permutation invariance verified across reordered inputs\n");
}

int main(void) {
    test_quorum_insufficient();
    test_normal_consensus();
    test_outlier_filtering();
    test_no_consensus_after_outliers();
    test_big_move_flag();
    test_permutation_invariance();
    return 0;
}
