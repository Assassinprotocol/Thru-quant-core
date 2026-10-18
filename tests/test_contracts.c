#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <setjmp.h>
#include <assert.h>
#include <stdint.h>
#include <stdbool.h>

#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>

#include "thru_math.h"
#include "../src/market_oracle.h"
#include "../src/clob_engine.h"

/* =========================================================================
 * MOCK THRU SDK & SYSCALL ENGINE
 * Provides complete in-memory ThruVM environment for testing actual C code.
 * ========================================================================= */

#define MOCK_MAX_ACCOUNTS (8)
#define MOCK_STORAGE_SIZE (65536)

static jmp_buf g_test_jmp;
static ulong g_last_revert_code = 0UL;
static ulong g_last_return_code = 0UL;
static bool g_has_reverted = false;
static bool g_has_returned = false;

typedef struct {
    uint8_t data[MOCK_STORAGE_SIZE];
    ulong data_sz;
    bool exists;
    bool writable;
} mock_account_t;

static mock_account_t g_accounts[MOCK_MAX_ACCOUNTS];

/* Mock transaction header */
static tsdk_txn_t g_mock_txn;
static tsdk_block_ctx_t g_mock_block_ctx;

/* Mock SDK syscall implementations */
int tsdk_is_account_idx_valid(ushort account_idx) {
    return account_idx < MOCK_MAX_ACCOUNTS;
}

int tsdk_account_exists(ushort account_idx) {
    if (!tsdk_is_account_idx_valid(account_idx)) return 0;
    return g_accounts[account_idx].exists ? 1 : 0;
}

tsdk_account_meta_t const *tsdk_get_account_meta(ushort account_idx) {
    static tsdk_account_meta_t meta;
    if (!tsdk_is_account_idx_valid(account_idx)) return NULL;
    meta.data_sz = g_accounts[account_idx].data_sz;
    return &meta;
}

void *tsdk_get_account_data_ptr(ushort account_idx) {
    if (!tsdk_is_account_idx_valid(account_idx)) return NULL;
    return (void *)g_accounts[account_idx].data;
}

ulong tsys_set_account_data_writable(ulong account_idx) {
    if (account_idx < MOCK_MAX_ACCOUNTS) {
        g_accounts[account_idx].writable = true;
    }
    return 0UL;
}

ulong tsys_account_resize(ulong account_idx, ulong new_sz) {
    if (account_idx >= MOCK_MAX_ACCOUNTS) return 1UL;
    if (!g_accounts[account_idx].writable) return 10UL; /* -10 not writable */
    if (new_sz > MOCK_STORAGE_SIZE) return 2UL;
    g_accounts[account_idx].data_sz = new_sz;
    return 0UL;
}

ulong tsys_account_create_ephemeral(ulong account_idx, uchar const seed[TN_SEED_SIZE]) {
    (void)seed;
    if (account_idx >= MOCK_MAX_ACCOUNTS) return 1UL;
    g_accounts[account_idx].exists = true;
    g_accounts[account_idx].data_sz = 0UL;
    memset(g_accounts[account_idx].data, 0, MOCK_STORAGE_SIZE);
    return 0UL;
}

ulong tsys_account_create(ulong account_idx, uchar const seed[TN_SEED_SIZE], void const *proof, ulong proof_sz) {
    (void)proof; (void)proof_sz;
    return tsys_account_create_ephemeral(account_idx, seed);
}

tsdk_txn_t const *tsdk_get_txn(void) {
    return &g_mock_txn;
}

tsdk_block_ctx_t const *tsdk_get_current_block_ctx(void) {
    return &g_mock_block_ctx;
}

void __attribute__(( noreturn )) tsdk_revert(ulong error_code) {
    g_has_reverted = true;
    g_last_revert_code = error_code;
    longjmp(g_test_jmp, 1);
}

void __attribute__(( noreturn )) tsdk_return(ulong return_code) {
    g_has_returned = true;
    g_last_return_code = return_code;
    longjmp(g_test_jmp, 2);
}

void tsdk_printf(char const *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    va_end(args);
}

/* Helper to reset mock environment */
static void reset_mock_env(void) {
    memset(g_accounts, 0, sizeof(g_accounts));
    memset(&g_mock_txn, 0, sizeof(g_mock_txn));
    memset(&g_mock_block_ctx, 0, sizeof(g_mock_block_ctx));

    // Default fee payer: 0x42
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x42, 32);

    // Current block context: slot 7743500, time 1791880000s
    g_mock_block_ctx.slot = 7743500UL;
    g_mock_block_ctx.block_time = 1791880000ULL * 1000000000ULL;

    g_has_reverted = false;
    g_has_returned = false;
    g_last_revert_code = 0UL;
    g_last_return_code = 0UL;
}

/* Include contract source files directly to test real static functions */
#undef TSDK_ENTRYPOINT_FN
#define TSDK_ENTRYPOINT_FN static __attribute__((noreturn))
#define start oracle_contract_start
#include "../src/market_oracle.c"
#undef start

#define start clob_contract_start
#include "../src/clob_engine.c"
#undef start
#undef start

/* =========================================================================
 * TEST SCENARIOS
 * ========================================================================= */

static void test_oracle_lifecycle_and_breaker(void) {
    printf("[SUITE 1] Testing Market Oracle Lifecycle, One-Time Init & Breaker...\n");
    reset_mock_env();

    ushort oracle_acc = 2;

    /* 1. Normal Initialize */
    oracle_init_args_t init_args;
    memset(&init_args, 0, sizeof(init_args));
    init_args.instruction_type = ORACLE_INSTR_INITIALIZE;
    init_args.oracle_account_idx = oracle_acc;

    int jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(&init_args, sizeof(init_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    oracle_account_data_t *data = (oracle_account_data_t *)g_accounts[oracle_acc].data;
    assert(data->version == 1);
    assert(data->circuit_breaker_active == 0);
    assert(memcmp(data->authority_pubkey, g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 32) == 0);
    printf("  [✓] 1. Initialized Oracle state (version=1, breaker=0, authority bound)\n");

    /* 2. Anti-State-Wipe Guard: Attempt second initialize */
    g_has_reverted = false;
    g_has_returned = false;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(&init_args, sizeof(init_args));
    }
    assert(g_has_reverted && g_last_revert_code == ORACLE_ERR_ALREADY_INITIALIZED);
    assert(data->version == 1); // State preserved!
    printf("  [✓] 2. Anti-State-Wipe: Double initialize safely reverted with 0x2008\n");

    /* 3. Normal Quote Update */
    g_has_reverted = false;
    g_has_returned = false;
    uint8_t update_buf[sizeof(oracle_update_hdr_t) + sizeof(oracle_entry_t)];
    oracle_update_hdr_t *hdr = (oracle_update_hdr_t *)update_buf;
    oracle_entry_t *entry = (oracle_entry_t *)(update_buf + sizeof(oracle_update_hdr_t));

    hdr->instruction_type = ORACLE_INSTR_UPDATE_PRICES;
    hdr->oracle_account_idx = oracle_acc;
    hdr->regime_id = 1;
    hdr->timestamp = 1791880005;
    hdr->entry_count = 1;

    q64_t btc_p1 = q64_from_int(80000);
    entry[0].symbol_id = 1;
    entry[0].price_q64_hi = (uint64_t)(btc_p1 >> 64);
    entry[0].price_q64_lo = (uint64_t)btc_p1;
    entry[0].volatility_bps = 120;
    entry[0].timestamp = 1791880005;

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(update_buf, sizeof(update_buf));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(data->entry_count == 1);
    assert(data->entries[0].symbol_id == 1);
    assert(data->entries[0].price_q64_hi == (uint64_t)(btc_p1 >> 64));
    assert(data->circuit_breaker_active == 0);
    printf("  [✓] 3. Normal price update succeeded on-chain (BTC $80,000)\n");

    /* 4. Circuit Breaker Trigger: Flash anomaly +12.5% ($80,000 -> $90,000 > 5%) */
    g_has_reverted = false;
    g_has_returned = false;
    q64_t btc_p2 = q64_from_int(90000);
    entry[0].price_q64_hi = (uint64_t)(btc_p2 >> 64);
    entry[0].price_q64_lo = (uint64_t)btc_p2;
    hdr->timestamp = 1791880010;
    entry[0].timestamp = 1791880010;

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(update_buf, sizeof(update_buf));
    }
    // Must commit via TSDK_SUCCESS without revert, locking breaker active
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(data->circuit_breaker_active == 1);
    // Quotes must NOT be updated with the anomalous price!
    assert(data->entries[0].price_q64_hi == (uint64_t)(btc_p1 >> 64));
    printf("  [✓] 4. Circuit breaker tripped: committed pause state cleanly without quote alteration\n");

    /* 5. Block Updates while Breaker is Active */
    g_has_reverted = false;
    g_has_returned = false;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(update_buf, sizeof(update_buf));
    }
    assert(g_has_reverted && g_last_revert_code == ORACLE_ERR_CIRCUIT_BREAKER);
    printf("  [✓] 5. Enforced Gate: Subsequent updates blocked with ORACLE_ERR_CIRCUIT_BREAKER\n");

    /* 6. Unauthorized Resume Attempt */
    g_has_reverted = false;
    g_has_returned = false;
    oracle_resume_args_t resume_args;
    resume_args.instruction_type = ORACLE_INSTR_RESUME;
    resume_args.oracle_account_idx = oracle_acc;

    // Mutate fee payer to unauthorized
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x99, 32);

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(&resume_args, sizeof(resume_args));
    }
    assert(g_has_reverted && g_last_revert_code == ORACLE_ERR_UNAUTHORIZED);
    assert(data->circuit_breaker_active == 1);
    printf("  [✓] 6. Unauthorized resume rejected with 0x2003\n");

    /* 7. Authorized Resume by Fee Payer Authority */
    g_has_reverted = false;
    g_has_returned = false;
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x42, 32); // Restore authority

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        oracle_contract_start(&resume_args, sizeof(resume_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(data->circuit_breaker_active == 0);
    printf("  [✓] 7. Authorized resume reset circuit breaker (breaker=0)\n");
}

static void test_clob_lifecycle_and_invariants(void) {
    printf("[SUITE 2] Testing CLOB Orderbook, Min Notional, & Match Invariants...\n");
    reset_mock_env();

    ushort clob_acc = 3;

    /* 1. Initialize CLOB */
    clob_init_args_t init_args;
    memset(&init_args, 0, sizeof(init_args));
    init_args.instruction_type = CLOB_INSTR_INIT;
    init_args.clob_account_idx = clob_acc;

    int jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&init_args, sizeof(init_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    clob_state_t *state = (clob_state_t *)g_accounts[clob_acc].data;
    assert(state->version == 1);
    assert(state->best_bid_idx == -1);
    assert(state->best_ask_idx == -1);
    printf("  [✓] 1. Initialized CLOB BBO book\n");

    /* 2. Double Init Guard */
    g_has_reverted = false;
    g_has_returned = false;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&init_args, sizeof(init_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_ALREADY_INITIALIZED);
    printf("  [✓] 2. Anti-State-Wipe: Double initialize safely reverted with 0x300A\n");

    /* 3. Min Notional Gate: Place order with notional < min_notional ($0.50 < $1.0) */
    g_has_reverted = false;
    g_has_returned = false;
    clob_place_order_args_t place_args;
    memset(&place_args, 0, sizeof(place_args));
    place_args.instruction_type = CLOB_INSTR_PLACE_LIMIT;
    place_args.clob_account_idx = clob_acc;
    place_args.side = CLOB_SIDE_BID;
    q64_t low_price = q64_from_ratio(1, 2); // $0.50
    place_args.price_hi = (uint64_t)(low_price >> 64);
    place_args.price_lo = (uint64_t)low_price;
    place_args.qty = 1; // 1 * $0.50 = $0.50 < $1.0 min notional

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_NOTIONAL_TOO_LOW);
    printf("  [✓] 3. Anti-DoS Gate: Order below min notional rejected with 0x3009\n");

    /* 4. Price > 0 Gate */
    g_has_reverted = false;
    g_has_returned = false;
    place_args.price_hi = 0;
    place_args.price_lo = 0;
    place_args.qty = 10;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_INVALID_PRICE);
    printf("  [✓] 4. Price Gate: Zero price rejected with 0x300B\n");

    /* 5. Quantity Conservation & Crossing Match Invariant */
    // Place resting BID: 10 ETH @ $2500
    g_has_reverted = false;
    g_has_returned = false;
    q64_t p2500 = q64_from_int(2500);
    place_args.side = CLOB_SIDE_BID;
    place_args.price_hi = (uint64_t)(p2500 >> 64);
    place_args.price_lo = (uint64_t)p2500;
    place_args.qty = 10;

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->bid_count == 1);
    assert(state->best_bid_idx != -1);
    assert(state->bids[state->best_bid_idx].qty == 10);
    uint64_t resting_bid_id = state->bids[state->best_bid_idx].order_id;

    // Crossing ASK: 4 ETH @ $2500
    g_has_reverted = false;
    g_has_returned = false;
    place_args.side = CLOB_SIDE_ASK;
    place_args.qty = 4;

    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    // Invariant: 4 matched, 6 resting BID remaining
    assert(state->bids[state->best_bid_idx].qty == 6);
    assert(state->ask_count == 0); // Completely consumed!
    printf("  [✓] 5. Invariant Verified: Total quantity strictly conserved (4 matched + 6 remaining = 10)\n");

    /* 6. Cancellation Authority Check */
    g_has_reverted = false;
    g_has_returned = false;
    clob_cancel_order_args_t cancel_args;
    cancel_args.instruction_type = CLOB_INSTR_CANCEL;
    cancel_args.clob_account_idx = clob_acc;
    cancel_args.order_id = resting_bid_id;

    // Unauthorized cancel attempt
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x88, 32);
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_UNAUTHORIZED);
    assert(state->bids[state->best_bid_idx].qty == 6); // Not cancelled!
    printf("  [✓] 6. Cancellation Authority: Unauthorized trader cannot cancel order (0x3003)\n");

    // Authorized cancel
    g_has_reverted = false;
    g_has_returned = false;
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x42, 32); // Creator
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->bid_count == 0);
    assert(state->best_bid_idx == -1);
    printf("  [✓] 7. Authorized cancel unlinked order node cleanly\n");

    /* 8. Trader Open Order Cap (K1): max 8 open orders per trader */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x99, 32);
    for (int i = 0; i < 8; i++) {
        g_has_reverted = false;
        g_has_returned = false;
        place_args.side = CLOB_SIDE_BID;
        q64_t p = q64_from_int(2000 - i * 10);
        place_args.price_hi = (uint64_t)(p >> 64);
        place_args.price_lo = (uint64_t)p;
        place_args.qty = 1;
        jmp_rc = setjmp(g_test_jmp);
        if (jmp_rc == 0) {
            clob_contract_start(&place_args, sizeof(place_args));
        }
        assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    }
    assert(state->bid_count == 8);

    /* 9th order must revert with CLOB_ERR_TRADER_LIMIT (0x300C) */
    g_has_reverted = false;
    g_has_returned = false;
    q64_t p9 = q64_from_int(1900);
    place_args.price_hi = (uint64_t)(p9 >> 64);
    place_args.price_lo = (uint64_t)p9;
    place_args.qty = 1;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_TRADER_LIMIT);
    printf("  [✓] 8. Anti-DoS: Trader exceeded max 8 open orders rejected (0x300C)\n");
}

int main(void) {
    test_oracle_lifecycle_and_breaker();
    test_clob_lifecycle_and_invariants();
    printf("test_contracts: all 15 scenarios passed\n");
    return 0;
}
