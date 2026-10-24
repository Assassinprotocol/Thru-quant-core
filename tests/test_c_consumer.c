#include <stdio.h>
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#include "thru_math.h"
#include "thru_oracle_consumer.h"
#include "../examples/c_consumer/lending_liquidator.h"
#include "../examples/c_consumer/perp_dex_consumer.h"
#include "../examples/c_consumer/dual_oracle_guard.h"

static thru_feed_account_view_t create_mock_feed(
    uint32_t symbol_id,
    uint64_t price,
    uint64_t confidence_bps,
    uint64_t publish_slot,
    uint32_t status
) {
    thru_feed_account_view_t feed;
    memset(&feed, 0, sizeof(feed));
    feed.magic = THRU_ORACLE_V2_FEED_MAGIC;
    feed.version = 2;
    feed.symbol_id = symbol_id;
    feed.status = status;
    feed.price = price;
    feed.confidence_bps = confidence_bps;
    feed.publish_slot = publish_slot;
    feed.median_source_ts = 1700000000ULL;
    feed.contributor_count = 5;
    return feed;
}

static void test_consumer_healthy_position(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t eth_feed = create_mock_feed(2, 2600, 20, slot, 1);
    thru_feed_account_view_t usdc_feed = create_mock_feed(5, 1, 5, slot, 1);

    loan_position_t pos = {
        .collateral_amount = 2,
        .debt_amount = 3000,
        .liquidation_threshold_bps = 8000
    };

    q64_t hf = 0;
    thru_consumer_status_t oracle_status = THRU_CONSUMER_OK;
    liquidation_eval_result_t res = evaluate_loan_liquidation(
        &pos, &eth_feed, &usdc_feed, slot, 60, 50, &hf, &oracle_status
    );

    assert(res == LIQUIDATION_EVAL_HEALTHY);
    assert(oracle_status == THRU_CONSUMER_OK);
    assert(hf >= Q64_ONE);

    q64_t expected_min = q64_from_ratio(138, 100);
    q64_t expected_max = q64_from_ratio(139, 100);
    assert(hf >= expected_min && hf <= expected_max);
    printf("  [PASS] test_consumer_healthy_position (HF: ~1.386)\n");
}

static void test_consumer_liquidatable_position(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t eth_feed = create_mock_feed(2, 1800, 20, slot, 1);
    thru_feed_account_view_t usdc_feed = create_mock_feed(5, 1, 5, slot, 1);

    loan_position_t pos = {
        .collateral_amount = 2,
        .debt_amount = 3000,
        .liquidation_threshold_bps = 8000
    };

    q64_t hf = 0;
    thru_consumer_status_t oracle_status = THRU_CONSUMER_OK;
    liquidation_eval_result_t res = evaluate_loan_liquidation(
        &pos, &eth_feed, &usdc_feed, slot, 60, 50, &hf, &oracle_status
    );

    assert(res == LIQUIDATION_EVAL_TRIGGERED);
    assert(oracle_status == THRU_CONSUMER_OK);
    assert(hf < Q64_ONE);

    q64_t expected_hf = q64_from_ratio(96, 100);
    q64_t diff = q64_abs(hf - expected_hf);
    assert(diff < (Q64_ONE / 1000));
    printf("  [PASS] test_consumer_liquidatable_position (HF: ~0.96)\n");
}

static void test_consumer_stale_rejection(void) {
    uint64_t slot = 1500100;
    thru_feed_account_view_t eth_feed = create_mock_feed(2, 2600, 20, 1500000, 1);
    thru_feed_account_view_t usdc_feed = create_mock_feed(5, 1, 5, slot, 1);

    loan_position_t pos = {
        .collateral_amount = 2,
        .debt_amount = 3000,
        .liquidation_threshold_bps = 8000
    };

    q64_t hf = 0;
    thru_consumer_status_t oracle_status = THRU_CONSUMER_OK;
    liquidation_eval_result_t res = evaluate_loan_liquidation(
        &pos, &eth_feed, &usdc_feed, slot, 60, 50, &hf, &oracle_status
    );

    assert(res == LIQUIDATION_EVAL_ERR_ORACLE);
    assert(oracle_status == THRU_CONSUMER_ERR_STALE);
    printf("  [PASS] test_consumer_stale_rejection (staleness delta: 100 > 60 slots)\n");
}

static void test_consumer_low_confidence_rejection(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t eth_feed = create_mock_feed(2, 2600, 250, slot, 1);
    thru_feed_account_view_t usdc_feed = create_mock_feed(5, 1, 5, slot, 1);

    loan_position_t pos = {
        .collateral_amount = 2,
        .debt_amount = 3000,
        .liquidation_threshold_bps = 8000
    };

    q64_t hf = 0;
    thru_consumer_status_t oracle_status = THRU_CONSUMER_OK;
    liquidation_eval_result_t res = evaluate_loan_liquidation(
        &pos, &eth_feed, &usdc_feed, slot, 60, 100, &hf, &oracle_status
    );

    assert(res == LIQUIDATION_EVAL_ERR_ORACLE);
    assert(oracle_status == THRU_CONSUMER_ERR_CONFIDENCE_TOO_LOW);
    printf("  [PASS] test_consumer_low_confidence_rejection (conf: 250 > max 100 bps)\n");
}

static void test_consumer_try_read_and_read_with_age(void) {
    uint64_t slot = 1500045;
    thru_feed_account_view_t btc_feed = create_mock_feed(1, 64250, 15, 1500000, 1);

    uint64_t price = 0;
    bool ok = thru_oracle_try_read(&btc_feed, &price);
    assert(ok && price == 64250);

    uint64_t age_slots = 0;
    thru_consumer_status_t st = thru_oracle_read_with_age(&btc_feed, slot, &price, &age_slots);
    assert(st == THRU_CONSUMER_OK);
    assert(price == 64250);
    assert(age_slots == 45);

    thru_feed_account_view_t paused_feed = create_mock_feed(1, 64250, 15, 1500000, 2);
    ok = thru_oracle_try_read(&paused_feed, &price);
    assert(!ok);

    st = thru_oracle_read_with_age(&paused_feed, slot, &price, &age_slots);
    assert(st == THRU_CONSUMER_ERR_PRICE_ZERO);

    printf("  [PASS] test_consumer_try_read_and_read_with_age\n");
}

static void test_consumer_perp_dex_clamping(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t btc_feed = create_mock_feed(1, 60000, 10, slot, 1);

    perp_market_params_t params = {
        .orderbook_mid_price = 63000,
        .max_clamping_deviation_bps = 300,
        .damping_factor_bps = 10000,
        .min_price_bound = 10000,
        .max_price_bound = 100000
    };

    perp_pricing_result_t res;
    memset(&res, 0, sizeof(res));

    thru_consumer_status_t st = evaluate_perp_mark_and_funding(
        &params, &btc_feed, slot, 60, 50, &res
    );
    assert(st == THRU_CONSUMER_OK);
    assert(res.oracle_status == THRU_CONSUMER_OK);
    assert(res.index_price == 60000);
    assert(res.mark_price == 61800);
    assert(res.is_clamped == true);
    assert(res.funding_rate_q64 > Q64_ZERO);

    params.orderbook_mid_price = 60100;
    st = evaluate_perp_mark_and_funding(&params, &btc_feed, slot, 60, 50, &res);
    assert(st == THRU_CONSUMER_OK);
    assert(res.mark_price == 60100);
    assert(res.is_clamped == false);

    params.orderbook_mid_price = 55000;
    st = evaluate_perp_mark_and_funding(&params, &btc_feed, slot, 60, 50, &res);
    assert(st == THRU_CONSUMER_OK);
    assert(res.mark_price == 58200);
    assert(res.is_clamped == true);
    assert(res.funding_rate_q64 < Q64_ZERO);

    printf("  [PASS] test_consumer_perp_dex_clamping (60k index -> 61.8k clamped mark, 60.1k normal)\n");
}

static void test_consumer_perp_dex_bounded_rejection(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t btc_feed = create_mock_feed(1, 85000, 10, slot, 1);

    perp_market_params_t params = {
        .orderbook_mid_price = 85000,
        .max_clamping_deviation_bps = 300,
        .damping_factor_bps = 10000,
        .min_price_bound = 20000,
        .max_price_bound = 80000
    };

    perp_pricing_result_t res;
    memset(&res, 0, sizeof(res));

    thru_consumer_status_t st = evaluate_perp_mark_and_funding(
        &params, &btc_feed, slot, 60, 50, &res
    );
    assert(st == THRU_CONSUMER_ERR_OUT_OF_BOUNDS);
    assert(res.oracle_status == THRU_CONSUMER_ERR_OUT_OF_BOUNDS);

    printf("  [PASS] test_consumer_perp_dex_bounded_rejection (85k exceeds 80k bound)\n");
}

static void test_consumer_dual_oracle_guard(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t pri_feed = create_mock_feed(1, 60000, 10, slot, 1);
    thru_feed_account_view_t sec_feed = create_mock_feed(1, 60060, 10, slot, 1);

    dual_oracle_config_t cfg = {
        .max_staleness_slots = 60,
        .max_confidence_bps = 50,
        .max_divergence_bps = 200,
        .min_price_bound = 10000,
        .max_price_bound = 100000
    };

    dual_oracle_result_t res;
    memset(&res, 0, sizeof(res));

    dual_oracle_resolution_t r = evaluate_dual_oracle_price(
        &cfg, &pri_feed, &sec_feed, slot, &res
    );
    assert(r == DUAL_ORACLE_RESOLVED_PRIMARY);
    assert(res.resolved_price == 60000);
    assert(res.divergence_bps == 10);

    thru_feed_account_view_t diverging_sec = create_mock_feed(1, 62000, 10, slot, 1);
    r = evaluate_dual_oracle_price(&cfg, &pri_feed, &diverging_sec, slot, &res);
    assert(r == DUAL_ORACLE_REVERT_DIVERGENCE);

    thru_feed_account_view_t stale_pri = create_mock_feed(1, 60000, 10, slot - 100, 1);
    r = evaluate_dual_oracle_price(&cfg, &stale_pri, &sec_feed, slot, &res);
    assert(r == DUAL_ORACLE_RESOLVED_SECONDARY_FALLBACK);
    assert(res.resolved_price == 60060);

    thru_feed_account_view_t stale_sec = create_mock_feed(1, 60060, 10, slot - 100, 1);
    r = evaluate_dual_oracle_price(&cfg, &stale_pri, &stale_sec, slot, &res);
    assert(r == DUAL_ORACLE_REVERT_UNAVAILABLE);

    printf("  [PASS] test_consumer_dual_oracle_guard (primary, divergence breaker, and stale fallback)\n");
}

static void test_consumer_cross_rate_synthesis(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t eth_feed = create_mock_feed(2, 2500, 10, slot, 1);
    thru_feed_account_view_t btc_feed = create_mock_feed(1, 50000, 15, slot, 1);

    q64_t cross_q64 = 0;
    uint64_t conf_bps = 0;
    thru_consumer_status_t st = thru_oracle_read_cross_rate(
        &eth_feed, &btc_feed, slot, 60, 50, &cross_q64, &conf_bps
    );
    assert(st == THRU_CONSUMER_OK);
    assert(conf_bps == 25);

    q64_t expected = q64_from_ratio(5, 100);
    q64_t diff = (cross_q64 >= expected) ? (cross_q64 - expected) : (expected - cross_q64);
    assert(diff < (Q64_ONE / 1000));

    printf("  [PASS] test_consumer_cross_rate_synthesis (ETH/USD 2500 / BTC/USD 50000 = 0.05 ETH/BTC)\n");
}

static void test_consumer_future_slot_and_inverted_bounds(void) {
    uint64_t slot = 1500000;
    thru_feed_account_view_t future_feed = create_mock_feed(1, 60000, 10, slot + 50, 1);
    uint64_t price = 0;
    uint64_t age = 0;

    thru_consumer_status_t st = thru_oracle_read_price(&future_feed, slot, 60, 50, &price);
    assert(st == THRU_CONSUMER_ERR_FUTURE_SLOT);

    st = thru_oracle_read_with_age(&future_feed, slot, &price, &age);
    assert(st == THRU_CONSUMER_ERR_FUTURE_SLOT);

    bool valid = thru_oracle_is_valid(&future_feed, slot, 60);
    assert(valid == false);

    thru_feed_account_view_t normal_feed = create_mock_feed(1, 60000, 10, slot, 1);
    st = thru_oracle_read_price_bounded(&normal_feed, slot, 60, 50, 70000, 50000, &price);
    assert(st == THRU_CONSUMER_ERR_INVALID_BOUNDS);

    printf("  [PASS] test_consumer_future_slot_and_inverted_bounds\n");
}

static void test_consumer_high_precision_dual_oracle_and_perp(void) {
    uint64_t slot = 1500000;
    uint64_t p1 = 2500000000000000000ULL;
    uint64_t p2 = 2600000000000000000ULL;

    thru_feed_account_view_t pri_feed = create_mock_feed(1, p1, 10, slot, 1);
    thru_feed_account_view_t sec_feed = create_mock_feed(1, p2, 10, slot, 1);

    dual_oracle_config_t cfg = {
        .max_staleness_slots = 60,
        .max_confidence_bps = 50,
        .max_divergence_bps = 200,
        .min_price_bound = 0,
        .max_price_bound = 0
    };

    dual_oracle_result_t dual_res;
    memset(&dual_res, 0, sizeof(dual_res));

    dual_oracle_resolution_t r = evaluate_dual_oracle_price(
        &cfg, &pri_feed, &sec_feed, slot, &dual_res
    );
    assert(r == DUAL_ORACLE_REVERT_DIVERGENCE);
    assert(dual_res.divergence_bps == 400);

    uint64_t index_p = 3000000000000000000ULL;
    thru_feed_account_view_t perp_feed = create_mock_feed(1, index_p, 10, slot, 1);
    perp_market_params_t params = {
        .orderbook_mid_price = 4000000000000000000ULL,
        .max_clamping_deviation_bps = 300,
        .damping_factor_bps = 10000,
        .min_price_bound = 0,
        .max_price_bound = 0
    };

    perp_pricing_result_t perp_res;
    memset(&perp_res, 0, sizeof(perp_res));

    thru_consumer_status_t st = evaluate_perp_mark_and_funding(
        &params, &perp_feed, slot, 60, 50, &perp_res
    );
    assert(st == THRU_CONSUMER_OK);
    assert(perp_res.is_clamped == true);
    assert(perp_res.mark_price == 3090000000000000000ULL);

    loan_position_t loan = {
        .collateral_amount = 2000000000ULL,
        .debt_amount = 1000000000ULL,
        .liquidation_threshold_bps = 8000
    };
    thru_feed_account_view_t col_feed = create_mock_feed(2, 2500, 10, slot, 1);
    thru_feed_account_view_t debt_feed = create_mock_feed(4, 1000, 10, slot, 1);

    q64_t hf = 0;
    thru_consumer_status_t or_st = THRU_CONSUMER_OK;
    liquidation_eval_result_t l_res = evaluate_loan_liquidation(
        &loan, &col_feed, &debt_feed, slot, 60, 50, &hf, &or_st
    );
    assert(l_res == LIQUIDATION_EVAL_HEALTHY);
    q64_t expected_hf = q64_from_ratio(4, 1);
    q64_t hf_diff = (hf >= expected_hf) ? (hf - expected_hf) : (expected_hf - hf);
    assert(hf_diff < (Q64_ONE / 1000));

    printf("  [PASS] test_consumer_high_precision_dual_oracle_and_perp\n");
}

int main(void) {
    printf("Running On-Chain C Reference Consumer Test Suite...\n");
    test_consumer_healthy_position();
    test_consumer_liquidatable_position();
    test_consumer_stale_rejection();
    test_consumer_low_confidence_rejection();
    test_consumer_try_read_and_read_with_age();
    test_consumer_perp_dex_clamping();
    test_consumer_perp_dex_bounded_rejection();
    test_consumer_dual_oracle_guard();
    test_consumer_cross_rate_synthesis();
    test_consumer_future_slot_and_inverted_bounds();
    test_consumer_high_precision_dual_oracle_and_perp();
    printf("All C consumer tests passed successfully.\n");
    return 0;
}
