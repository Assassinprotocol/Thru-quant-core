#include "perp_dex_consumer.h"

thru_consumer_status_t evaluate_perp_mark_and_funding(
    const perp_market_params_t *params,
    const thru_feed_account_view_t *index_feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    perp_pricing_result_t *out_result
) {
    if (!params || !index_feed || !out_result) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }

    uint64_t index_price = 0;
    thru_consumer_status_t st = thru_oracle_read_price_bounded(
        index_feed,
        current_slot,
        max_staleness_slots,
        max_confidence_bps,
        params->min_price_bound,
        params->max_price_bound,
        &index_price
    );
    if (st != THRU_CONSUMER_OK) {
        out_result->oracle_status = st;
        return st;
    }

    out_result->index_price = index_price;
    out_result->oracle_status = THRU_CONSUMER_OK;

    if (index_price == 0) {
        out_result->mark_price = 0;
        out_result->funding_rate_q64 = Q64_ZERO;
        out_result->is_clamped = false;
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }

    __extension__ typedef unsigned __int128 u128_t;
    int64_t raw_delta = (int64_t)params->orderbook_mid_price - (int64_t)index_price;
    int64_t max_delta = (int64_t)(((u128_t)index_price * params->max_clamping_deviation_bps) / 10000ULL);

    int64_t clamped_delta = raw_delta;
    bool clamped = false;
    if (raw_delta > max_delta) {
        clamped_delta = max_delta;
        clamped = true;
    } else if (raw_delta < -max_delta) {
        clamped_delta = -max_delta;
        clamped = true;
    }

    int64_t mark_price_signed = (int64_t)index_price + clamped_delta;
    if (mark_price_signed <= 0) {
        out_result->mark_price = index_price;
    } else {
        out_result->mark_price = (uint64_t)mark_price_signed;
    }
    out_result->is_clamped = clamped;

    q64_t premium_rate = q64_from_ratio(clamped_delta, (int64_t)index_price);

    uint64_t damping_bps = (params->damping_factor_bps > 0) ? params->damping_factor_bps : 10000ULL;
    q64_t damping_q64 = q64_from_ratio((int64_t)damping_bps, 10000);
    out_result->funding_rate_q64 = q64_mul(premium_rate, damping_q64);

    return THRU_CONSUMER_OK;
}
