#ifndef PERP_DEX_CONSUMER_H
#define PERP_DEX_CONSUMER_H

#include <stdint.h>
#include <stdbool.h>
#include "thru_math.h"
#include "thru_oracle_consumer.h"

typedef struct {
    uint64_t orderbook_mid_price;
    uint64_t max_clamping_deviation_bps;
    uint64_t damping_factor_bps;
    uint64_t min_price_bound;
    uint64_t max_price_bound;
} perp_market_params_t;

typedef struct {
    uint64_t index_price;
    uint64_t mark_price;
    q64_t funding_rate_q64;
    bool is_clamped;
    thru_consumer_status_t oracle_status;
} perp_pricing_result_t;

thru_consumer_status_t evaluate_perp_mark_and_funding(
    const perp_market_params_t *params,
    const thru_feed_account_view_t *index_feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    perp_pricing_result_t *out_result
);

#endif /* PERP_DEX_CONSUMER_H */
