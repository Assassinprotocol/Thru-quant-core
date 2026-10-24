#ifndef LENDING_LIQUIDATOR_H
#define LENDING_LIQUIDATOR_H

#include <stdint.h>
#include <stdbool.h>
#include "thru_math.h"
#include "thru_oracle_consumer.h"

typedef struct {
    uint64_t collateral_amount;
    uint64_t debt_amount;
    uint64_t liquidation_threshold_bps;
} loan_position_t;

typedef enum {
    LIQUIDATION_EVAL_HEALTHY = 0,
    LIQUIDATION_EVAL_TRIGGERED = 1,
    LIQUIDATION_EVAL_ERR_ORACLE = 2
} liquidation_eval_result_t;

liquidation_eval_result_t evaluate_loan_liquidation(
    const loan_position_t *position,
    const thru_feed_account_view_t *collateral_feed,
    const thru_feed_account_view_t *debt_feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    q64_t *out_health_factor,
    thru_consumer_status_t *out_oracle_status
);

#endif /* LENDING_LIQUIDATOR_H */
