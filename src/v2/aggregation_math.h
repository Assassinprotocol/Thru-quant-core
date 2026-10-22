#ifndef THRU_ORACLE_V2_AGGREGATION_MATH_H
#define THRU_ORACLE_V2_AGGREGATION_MATH_H

#include <stdint.h>
#include <stdbool.h>

#define ORACLE_V2_MAX_PUBLISHERS 7

typedef struct {
    uint64_t price;
    uint64_t source_ts;
} quote_entry_t;

typedef struct {
    uint64_t price;
    uint64_t confidence_bps;
    uint32_t flags;
    uint32_t contributor_count;
    bool success;
} aggregation_output_t;

#define FEED_FLAG_STALE             (1U << 0)
#define FEED_FLAG_BIG_MOVE          (1U << 1)
#define FEED_FLAG_LOW_CONFIDENCE    (1U << 2)
#define FEED_FLAG_OUTLIER_REJECTED  (1U << 3)

aggregation_output_t aggregate_symbol_quotes(
    const quote_entry_t *quotes,
    uint32_t count,
    uint32_t min_quorum,
    uint32_t outlier_bps,
    uint32_t big_move_bps,
    uint64_t prev_price
);

#endif /* THRU_ORACLE_V2_AGGREGATION_MATH_H */
