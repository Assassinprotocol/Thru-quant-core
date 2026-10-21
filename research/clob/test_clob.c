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
#include "clob_engine.h"

/* =========================================================================
 * MOCK THRU SDK & SYSCALL ENGINE FOR CLOB RESEARCH ENGINE
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
static tsdk_txn_t g_mock_txn;
static tsdk_block_ctx_t g_mock_block_ctx;

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
    if (!g_accounts[account_idx].writable) return 10UL;
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

static void reset_mock_env(void) {
    memset(g_accounts, 0, sizeof(g_accounts));
    memset(&g_mock_txn, 0, sizeof(g_mock_txn));
    memset(&g_mock_block_ctx, 0, sizeof(g_mock_block_ctx));

    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x42, 32);
    g_mock_block_ctx.slot = 7743500UL;
    g_mock_block_ctx.block_time = 1791880000ULL * 1000000000ULL;

    g_has_reverted = false;
    g_has_returned = false;
    g_last_revert_code = 0UL;
    g_last_return_code = 0UL;
}

#undef TSDK_ENTRYPOINT_FN
#define TSDK_ENTRYPOINT_FN static __attribute__((noreturn))
#define start clob_contract_start
#include "clob_engine.c"
#undef start

static void test_clob_lifecycle_and_invariants(void) {
    printf("[CLOB RESEARCH SUITE] Testing CLOB Orderbook, Min Notional, & Match Invariants...\n");
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
    place_args.qty = 1;

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

    /* 5. Place Resting BID and Match Crossing ASK */
    g_has_reverted = false;
    g_has_returned = false;
    q64_t p2500 = q64_from_int(2500);
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
    assert(state->bids[state->best_bid_idx].qty == 6);
    assert(state->ask_count == 0);
    printf("  [✓] 5. Invariant Verified: Total quantity strictly conserved (4 matched + 6 remaining = 10)\n");

    /* 6. Cancellation Authority Check */
    g_has_reverted = false;
    g_has_returned = false;
    clob_cancel_order_args_t cancel_args;
    cancel_args.instruction_type = CLOB_INSTR_CANCEL;
    cancel_args.clob_account_idx = clob_acc;
    cancel_args.order_id = resting_bid_id;

    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x88, 32);
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_UNAUTHORIZED);
    assert(state->bids[state->best_bid_idx].qty == 6);
    printf("  [✓] 6. Cancellation Authority: Unauthorized trader cannot cancel order (0x3003)\n");

    // Authorized cancel
    g_has_reverted = false;
    g_has_returned = false;
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x42, 32);
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->bid_count == 0);
    assert(state->best_bid_idx == -1);
    printf("  [✓] 7. Authorized cancel unlinked order node cleanly\n");

    /* 8. Anti-DoS Trader Order Limit (BID) */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x55, 32);
    for (int i = 0; i < 8; i++) {
        place_args.side = CLOB_SIDE_BID;
        q64_t p = q64_from_int(1000 + i);
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

    g_has_reverted = false;
    g_has_returned = false;
    q64_t p_exceed = q64_from_int(1008);
    place_args.price_hi = (uint64_t)(p_exceed >> 64);
    place_args.price_lo = (uint64_t)p_exceed;
    place_args.qty = 1;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_TRADER_LIMIT);
    printf("  [✓] 8. Anti-DoS: Trader exceeded max 8 open orders rejected (0x300C)\n");

    /* 9. Sorted ASK Insertion */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x77, 32);
    place_args.side = CLOB_SIDE_ASK;
    q64_t p2600 = q64_from_int(2600);
    place_args.price_hi = (uint64_t)(p2600 >> 64);
    place_args.price_lo = (uint64_t)p2600;
    place_args.qty = 5;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->ask_count == 1);
    assert(state->best_ask_idx != -1);
    printf("  [✓] 9. Resting ASK placed into sorted list (5 ETH @ $2600)\n");

    /* 10. Crossing BID Match */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x66, 32);
    place_args.side = CLOB_SIDE_BID;
    place_args.price_hi = (uint64_t)(p2600 >> 64);
    place_args.price_lo = (uint64_t)p2600;
    place_args.qty = 2;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->asks[state->best_ask_idx].qty == 3);
    printf("  [✓] 10. Crossing BID matched resting ASK: 2 filled, 3 resting remaining\n");

    /* 11. Cancel remaining ASK */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x77, 32);
    cancel_args.order_id = state->asks[state->best_ask_idx].order_id;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->ask_count == 0);
    printf("  [✓] 11. Authorized ASK cancel removed node from orderbook\n");

    /* 12. Anti-DoS Trader Order Limit (ASK) */
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x99, 32);
    for (int i = 0; i < 8; i++) {
        place_args.side = CLOB_SIDE_ASK;
        q64_t p = q64_from_int(3000 + i);
        place_args.price_hi = (uint64_t)(p >> 64);
        place_args.price_lo = (uint64_t)p;
        place_args.qty = 1;
        jmp_rc = setjmp(g_test_jmp);
        if (jmp_rc == 0) {
            clob_contract_start(&place_args, sizeof(place_args));
        }
        assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    }
    assert(state->ask_count == 8);

    g_has_reverted = false;
    g_has_returned = false;
    q64_t p_exceed_ask = q64_from_int(3008);
    place_args.price_hi = (uint64_t)(p_exceed_ask >> 64);
    place_args.price_lo = (uint64_t)p_exceed_ask;
    place_args.qty = 1;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_TRADER_LIMIT);
    printf("  [✓] 12. Anti-DoS: Trader exceeded max 8 open ASK orders rejected (0x300C)\n");

    /* 13. Invalid Side / Opcode Checks */
    g_has_reverted = false;
    g_has_returned = false;
    place_args.qty = 0;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_INVALID_QTY);

    place_args.instruction_type = 999;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_INVALID_INSTR_TYPE);
    printf("  [✓] 13. Rejected zero quantity and unknown instruction opcode\n");

    /* 14. Nonexistent Order Cancellation */
    cancel_args.order_id = 999999ULL;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_ORDER_NOT_FOUND);
    printf("  [✓] 14. Nonexistent order cancellation rejected with 0x3005\n");

    // 14b. Cancel on uninitialized account
    cancel_args.clob_account_idx = 4;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&cancel_args, sizeof(cancel_args));
    }
    assert(g_has_reverted && g_last_revert_code == CLOB_ERR_DATA_ACCESS_FAILED);
    printf("  [✓] 14b. Cancellation on uninitialized account rejected with 0x3004\n");

    /* 15. Complete Order Consumption & Double-Sided Best Insertion */
    reset_mock_env();
    memset(&init_args, 0, sizeof(init_args));
    init_args.instruction_type = CLOB_INSTR_INIT;
    init_args.clob_account_idx = clob_acc;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&init_args, sizeof(init_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);

    // Place resting ASK 10 @ 2500
    memset(&place_args, 0, sizeof(place_args));
    place_args.instruction_type = CLOB_INSTR_PLACE_LIMIT;
    place_args.clob_account_idx = clob_acc;
    place_args.side = CLOB_SIDE_ASK;
    q64_t p2500_ask = q64_from_int(2500);
    place_args.price_hi = (uint64_t)(p2500_ask >> 64);
    place_args.price_lo = (uint64_t)p2500_ask;
    place_args.qty = 10;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);

    // Place lower resting ASK 5 @ 2400 (new best ask, prev == -1)
    q64_t p2400_ask = q64_from_int(2400);
    place_args.price_hi = (uint64_t)(p2400_ask >> 64);
    place_args.price_lo = (uint64_t)p2400_ask;
    place_args.qty = 5;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->ask_count == 2);

    // Crossing BID 15 @ 2500 consumes both ASKs completely
    place_args.side = CLOB_SIDE_BID;
    place_args.price_hi = (uint64_t)(p2500_ask >> 64);
    place_args.price_lo = (uint64_t)p2500_ask;
    place_args.qty = 15;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->ask_count == 0);
    assert(state->best_ask_idx == -1);

    // Place resting BID 10 @ 2000
    place_args.side = CLOB_SIDE_BID;
    q64_t p2000_bid = q64_from_int(2000);
    place_args.price_hi = (uint64_t)(p2000_bid >> 64);
    place_args.price_lo = (uint64_t)p2000_bid;
    place_args.qty = 10;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);

    // Place higher resting BID 5 @ 2100 (new best bid, prev == -1)
    q64_t p2100_bid = q64_from_int(2100);
    place_args.price_hi = (uint64_t)(p2100_bid >> 64);
    place_args.price_lo = (uint64_t)p2100_bid;
    place_args.qty = 5;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->bid_count == 2);

    // Crossing ASK 15 @ 2000 consumes both BIDs completely
    place_args.side = CLOB_SIDE_ASK;
    place_args.price_hi = (uint64_t)(p2000_bid >> 64);
    place_args.price_lo = (uint64_t)p2000_bid;
    place_args.qty = 15;
    jmp_rc = setjmp(g_test_jmp);
    if (jmp_rc == 0) {
        clob_contract_start(&place_args, sizeof(place_args));
    }
    assert(g_has_returned && g_last_return_code == TSDK_SUCCESS);
    assert(state->bid_count == 0);
    assert(state->best_bid_idx == -1);
    printf("  [✓] 15. Verified complete order consumption & best-price insertion on both sides\n");
}

int main(void) {
    test_clob_lifecycle_and_invariants();
    printf("test_clob: all scenarios passed\n");
    return 0;
}
