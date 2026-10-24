#ifndef DUAL_ORACLE_GUARD_H
#define DUAL_ORACLE_GUARD_H

#include <stdint.h>
#include <stdbool.h>
#include "thru_math.h"
#include "thru_oracle_consumer.h"

typedef enum {
    DUAL_ORACLE_RESOLVED_PRIMARY = 0,
    DUAL_ORACLE_RESOLVED_SECONDARY_FALLBACK = 1,
    DUAL_ORACLE_REVERT_DIVERGENCE = 2,
    DUAL_ORACLE_REVERT_UNAVAILABLE = 3
} dual_oracle_resolution_t;

typedef struct {
    uint64_t max_staleness_slots;
    uint64_t max_confidence_bps;
    uint64_t max_divergence_bps;
    uint64_t min_price_bound;
    uint64_t max_price_bound;
} dual_oracle_config_t;

typedef struct {
    uint64_t resolved_price;
    uint64_t primary_price;
    uint64_t secondary_price;
    uint64_t divergence_bps;
    dual_oracle_resolution_t resolution;
} dual_oracle_result_t;

dual_oracle_resolution_t evaluate_dual_oracle_price(
    const dual_oracle_config_t *config,
    const thru_feed_account_view_t *primary_feed,
    const thru_feed_account_view_t *secondary_feed,
    uint64_t current_slot,
    dual_oracle_result_t *out_result
);

#endif /* DUAL_ORACLE_GUARD_H */
