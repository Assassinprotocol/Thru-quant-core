#include "lending_liquidator.h"

liquidation_eval_result_t evaluate_loan_liquidation(
    const loan_position_t *position,
    const thru_feed_account_view_t *collateral_feed,
    const thru_feed_account_view_t *debt_feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    q64_t *out_health_factor,
    thru_consumer_status_t *out_oracle_status
) {
    if (!position || !collateral_feed || !debt_feed || !out_health_factor) {
        if (out_oracle_status) *out_oracle_status = THRU_CONSUMER_ERR_PRICE_ZERO;
        return LIQUIDATION_EVAL_ERR_ORACLE;
    }

    uint64_t col_price = 0;
    thru_consumer_status_t col_status = thru_oracle_read_price(
        collateral_feed,
        current_slot,
        max_staleness_slots,
        max_confidence_bps,
        &col_price
    );
    if (col_status != THRU_CONSUMER_OK) {
        if (out_oracle_status) *out_oracle_status = col_status;
        return LIQUIDATION_EVAL_ERR_ORACLE;
    }

    uint64_t debt_price = 0;
    thru_consumer_status_t debt_status = thru_oracle_read_price(
        debt_feed,
        current_slot,
        max_staleness_slots,
        max_confidence_bps,
        &debt_price
    );
    if (debt_status != THRU_CONSUMER_OK) {
        if (out_oracle_status) *out_oracle_status = debt_status;
        return LIQUIDATION_EVAL_ERR_ORACLE;
    }

    if (position->debt_amount == 0 || debt_price == 0) {
        *out_health_factor = Q64_MAX;
        if (out_oracle_status) *out_oracle_status = THRU_CONSUMER_OK;
        return LIQUIDATION_EVAL_HEALTHY;
    }

    q64_t col_to_debt = q64_from_ratio((int64_t)position->collateral_amount, (int64_t)position->debt_amount);
    q64_t price_ratio = q64_from_ratio((int64_t)col_price, (int64_t)debt_price);
    q64_t ltv = q64_from_ratio((int64_t)position->liquidation_threshold_bps, 10000);

    q64_t hf = q64_mul(q64_mul(col_to_debt, price_ratio), ltv);
    *out_health_factor = hf;
    if (out_oracle_status) *out_oracle_status = THRU_CONSUMER_OK;

    return (hf < Q64_ONE) ? LIQUIDATION_EVAL_TRIGGERED : LIQUIDATION_EVAL_HEALTHY;
}
