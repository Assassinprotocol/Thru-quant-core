#include "dual_oracle_guard.h"

dual_oracle_resolution_t evaluate_dual_oracle_price(
    const dual_oracle_config_t *config,
    const thru_feed_account_view_t *primary_feed,
    const thru_feed_account_view_t *secondary_feed,
    uint64_t current_slot,
    dual_oracle_result_t *out_result
) {
    if (!config || !out_result) {
        return DUAL_ORACLE_REVERT_UNAVAILABLE;
    }

    out_result->resolved_price = 0;
    out_result->primary_price = 0;
    out_result->secondary_price = 0;
    out_result->divergence_bps = 0;
    out_result->resolution = DUAL_ORACLE_REVERT_UNAVAILABLE;

    uint64_t pri_price = 0;
    thru_consumer_status_t pri_st = thru_oracle_read_price_bounded(
        primary_feed,
        current_slot,
        config->max_staleness_slots,
        config->max_confidence_bps,
        config->min_price_bound,
        config->max_price_bound,
        &pri_price
    );

    uint64_t sec_price = 0;
    thru_consumer_status_t sec_st = thru_oracle_read_price_bounded(
        secondary_feed,
        current_slot,
        config->max_staleness_slots,
        config->max_confidence_bps,
        config->min_price_bound,
        config->max_price_bound,
        &sec_price
    );

    out_result->primary_price = pri_price;
    out_result->secondary_price = sec_price;

    if (pri_st == THRU_CONSUMER_OK) {
        if (sec_st == THRU_CONSUMER_OK && config->max_divergence_bps > 0 && pri_price > 0) {
            __extension__ typedef unsigned __int128 u128_t;
            uint64_t diff = (pri_price >= sec_price) ? (pri_price - sec_price) : (sec_price - pri_price);
            uint64_t div_bps = (uint64_t)(((u128_t)diff * 10000ULL) / pri_price);
            out_result->divergence_bps = div_bps;
            if (div_bps > config->max_divergence_bps) {
                out_result->resolution = DUAL_ORACLE_REVERT_DIVERGENCE;
                return DUAL_ORACLE_REVERT_DIVERGENCE;
            }
        }
        out_result->resolved_price = pri_price;
        out_result->resolution = DUAL_ORACLE_RESOLVED_PRIMARY;
        return DUAL_ORACLE_RESOLVED_PRIMARY;
    }

    if (sec_st == THRU_CONSUMER_OK) {
        out_result->resolved_price = sec_price;
        out_result->resolution = DUAL_ORACLE_RESOLVED_SECONDARY_FALLBACK;
        return DUAL_ORACLE_RESOLVED_SECONDARY_FALLBACK;
    }

    out_result->resolution = DUAL_ORACLE_REVERT_UNAVAILABLE;
    return DUAL_ORACLE_REVERT_UNAVAILABLE;
}
