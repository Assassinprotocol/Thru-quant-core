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

#include "oracle_v2.h"
#include "thru_oracle_consumer.h"

#define MOCK_MAX_ACCOUNTS (32)
#define MOCK_STORAGE_SIZE (65536)

static jmp_buf g_test_jmp;
static ulong g_last_revert = 0UL;
static ulong g_last_return = 0UL;
static bool g_reverted = false;
static bool g_returned = false;
static bool g_event_emitted = false;
static event_aggregate_updated_t g_last_event;

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

const tsdk_account_meta_t *tsdk_get_account_meta(ushort account_idx) {
    static tsdk_account_meta_t meta;
    if (!tsdk_is_account_idx_valid(account_idx)) return NULL;
    meta.data_sz = (uint32_t)g_accounts[account_idx].data_sz;
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

ulong tsys_account_create_ephemeral(ulong account_idx, const uchar seed[TN_SEED_SIZE]) {
    (void)seed;
    if (account_idx >= MOCK_MAX_ACCOUNTS) return 1UL;
    g_accounts[account_idx].exists = true;
    g_accounts[account_idx].data_sz = 0UL;
    memset(g_accounts[account_idx].data, 0, MOCK_STORAGE_SIZE);
    return 0UL;
}

ulong tsys_account_create(ulong account_idx, const uchar seed[TN_SEED_SIZE], const void *proof, ulong proof_sz) {
    (void)proof; (void)proof_sz;
    return tsys_account_create_ephemeral(account_idx, seed);
}

const tsdk_txn_t *tsdk_get_txn(void) {
    return &g_mock_txn;
}

const tsdk_block_ctx_t *tsdk_get_current_block_ctx(void) {
    return &g_mock_block_ctx;
}

void __attribute__((noreturn)) tsdk_revert(ulong code) {
    g_reverted = true;
    g_last_revert = code;
    longjmp(g_test_jmp, 1);
}

void __attribute__((noreturn)) tsdk_return(ulong code) {
    g_returned = true;
    g_last_return = code;
    longjmp(g_test_jmp, 2);
}

void tsdk_printf(const char *fmt, ...) {
    va_list args;
    va_start(args, fmt);
    va_end(args);
}

ulong tsys_emit_event(const void *data, ulong sz) {
    if (sz == sizeof(event_aggregate_updated_t)) {
        g_event_emitted = true;
        memcpy(&g_last_event, data, sz);
    }
    return 0UL;
}

static void reset_env(void) {
    memset(g_accounts, 0, sizeof(g_accounts));
    memset(&g_mock_txn, 0, sizeof(g_mock_txn));
    memset(&g_mock_block_ctx, 0, sizeof(g_mock_block_ctx));
    g_mock_block_ctx.slot = 1000;
    g_mock_block_ctx.block_time = 1700000000ULL * 1000000000ULL;
    g_reverted = false;
    g_returned = false;
    g_last_revert = 0;
    g_last_return = 0;
    g_event_emitted = false;
}

#include "../src/v2/oracle_v2.c"

static void test_registry_init(void) {
    reset_env();
    init_registry_args_t args = {
        .opcode = ORACLE_V2_OP_INITIALIZE_REGISTRY,
        .registry_acc_idx = 0,
        .admin_m = 3,
        .admin_n = 5,
        .min_publishers = 3
    };
    for (int i = 0; i < 5; i++) memset(args.admin_keys[i], i + 1, 32);

    if (setjmp(g_test_jmp) == 0) {
        start(&args, sizeof(args));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    const registry_account_data_t *reg = (const registry_account_data_t *)g_accounts[0].data;
    assert(reg->magic == ORACLE_V2_REGISTRY_MAGIC);
    assert(reg->version == 2);
    assert(reg->admin_m == 3);
    assert(reg->admin_n == 5);
    assert(reg->min_publishers == 3);
    assert(reg->feed_count == 6);

    g_reverted = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&args, sizeof(args));
    }
    assert(g_reverted && g_last_revert == ORACLE_V2_ERR_ALREADY_INIT);
    printf("  [PASS] Registry initialization and re-init prevention\n");
}

static void test_publisher_management(void) {
    test_registry_init();
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 1, 32);

    uint8_t pubkey_a[32];
    memset(pubkey_a, 0xAA, 32);
    set_publisher_args_t add_pub = {
        .opcode = ORACLE_V2_OP_SET_PUBLISHER,
        .registry_acc_idx = 0,
        .status = 1
    };
    memcpy(add_pub.publisher_pubkey, pubkey_a, 32);

    g_returned = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&add_pub, sizeof(add_pub));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    const registry_account_data_t *reg = (const registry_account_data_t *)g_accounts[0].data;
    assert(reg->publisher_count == 1);
    assert(memcmp(reg->publishers[0].pubkey, pubkey_a, 32) == 0);
    assert(reg->publishers[0].status == 1);

    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0xEE, 32);
    g_reverted = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&add_pub, sizeof(add_pub));
    }
    assert(g_reverted && g_last_revert == ORACLE_V2_ERR_UNAUTHORIZED);
    printf("  [PASS] Publisher enrollment and authorization checks\n");
}

static void test_timelock_governance(void) {
    test_registry_init();
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 1, 32);

    queue_config_args_t q = {
        .opcode = ORACLE_V2_OP_QUEUE_CONFIG,
        .registry_acc_idx = 0,
        .action_id = 1,
        .target_id = 0,
        .param_val = 4
    };

    g_returned = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&q, sizeof(q));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    apply_config_args_t app = {
        .opcode = ORACLE_V2_OP_APPLY_CONFIG,
        .registry_acc_idx = 0,
        .queue_index = 0
    };

    g_reverted = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&app, sizeof(app));
    }
    assert(g_reverted && g_last_revert == ORACLE_V2_ERR_TIMELOCK_NOT_EXPIRED);

    g_mock_block_ctx.block_time += (86400ULL + 1ULL) * 1000000000ULL;
    g_returned = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&app, sizeof(app));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    const registry_account_data_t *reg = (const registry_account_data_t *)g_accounts[0].data;
    assert(reg->min_publishers == 4);
    assert(reg->timelock_count == 0);
    printf("  [PASS] 24-hour timelock queue and delay enforcement\n");
}

static void test_emergency_pause_resume(void) {
    test_registry_init();
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 1, 32);

    emergency_symbol_args_t pause_cmd = {
        .opcode = ORACLE_V2_OP_EMERGENCY_PAUSE,
        .registry_acc_idx = 0,
        .feed_acc_idx = 1,
        .symbol_id = 1
    };

    g_returned = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&pause_cmd, sizeof(pause_cmd));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    const registry_account_data_t *reg = (const registry_account_data_t *)g_accounts[0].data;
    assert(reg->feeds[0].status == 2);

    emergency_symbol_args_t resume_cmd = {
        .opcode = ORACLE_V2_OP_EMERGENCY_RESUME,
        .registry_acc_idx = 0,
        .feed_acc_idx = 1,
        .symbol_id = 1
    };

    g_returned = false;
    if (setjmp(g_test_jmp) == 0) {
        start(&resume_cmd, sizeof(resume_cmd));
    }
    assert(g_returned && g_last_return == TSDK_SUCCESS);
    assert(reg->feeds[0].status == 1);
    printf("  [PASS] Emergency pause and resume execution\n");
}

static void test_submission_and_aggregation(void) {
    test_registry_init();
    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 1, 32);

    for (uint32_t i = 0; i < 5; i++) {
        set_publisher_args_t p = {
            .opcode = ORACLE_V2_OP_SET_PUBLISHER,
            .registry_acc_idx = 0,
            .status = 1
        };
        memset(p.publisher_pubkey, (int)(i + 10), 32);
        g_returned = false;
        if (setjmp(g_test_jmp) == 0) start(&p, sizeof(p));
        assert(g_returned && g_last_return == TSDK_SUCCESS);
    }

    const uint64_t btc_prices[5] = {
        8400000000000ULL,
        8400500000000ULL,
        8401000000000ULL,
        8401500000000ULL,
        8402000000000ULL
    };

    for (uint32_t i = 0; i < 5; i++) {
        memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, (int)(i + 10), 32);
        struct {
            submit_prices_hdr_t hdr;
            raw_quote_t quote;
        } payload;

        payload.hdr.opcode = ORACLE_V2_OP_SUBMIT_PRICES;
        payload.hdr.registry_acc_idx = 0;
        payload.hdr.submission_acc_idx = (uint16_t)(10 + i);
        payload.hdr.sequence_number = 1;
        payload.hdr.quote_count = 1;
        payload.quote.symbol_id = 1;
        payload.quote.reserved = 0;
        payload.quote.price = btc_prices[i];
        payload.quote.source_ts = 1700000000ULL;

        g_returned = false;
        if (setjmp(g_test_jmp) == 0) start(&payload, sizeof(payload));
        assert(g_returned && g_last_return == TSDK_SUCCESS);

        g_reverted = false;
        if (setjmp(g_test_jmp) == 0) start(&payload, sizeof(payload));
        assert(g_reverted && g_last_revert == ORACLE_V2_ERR_INVALID_SEQUENCE);
    }

    aggregate_args_t agg = {
        .opcode = ORACLE_V2_OP_AGGREGATE,
        .registry_acc_idx = 0,
        .feed_acc_idx = 1,
        .symbol_id = 1,
        .submission_acc_indices = {10, 11, 12, 13, 14, 0, 0}
    };

    g_returned = false;
    g_event_emitted = false;
    if (setjmp(g_test_jmp) == 0) start(&agg, sizeof(agg));
    assert(g_returned && g_last_return == TSDK_SUCCESS);

    const feed_account_data_t *feed = (const feed_account_data_t *)g_accounts[1].data;
    assert(feed->magic == ORACLE_V2_FEED_MAGIC);
    assert(feed->symbol_id == 1);
    assert(feed->price == 8401000000000ULL);
    assert(feed->contributor_count == 5);
    assert(g_event_emitted);
    assert(g_last_event.price == 8401000000000ULL);
    assert(g_last_event.symbol_id == 1);

    uint64_t read_price = 0;
    thru_consumer_status_t status = thru_oracle_read_price(
        (const thru_feed_account_view_t *)feed,
        1000,
        120,
        50,
        &read_price
    );
    assert(status == THRU_CONSUMER_OK);
    assert(read_price == 8401000000000ULL);

    status = thru_oracle_read_price(
        (const thru_feed_account_view_t *)feed,
        1200,
        120,
        50,
        &read_price
    );
    assert(status == THRU_CONSUMER_ERR_STALE);

    printf("  [PASS] Quotes submission, crank aggregation, event emission, and consumer safety kit\n");
}

int main(void) {
    test_registry_init();
    test_publisher_management();
    test_timelock_governance();
    test_emergency_pause_resume();
    test_submission_and_aggregation();
    printf("\nAll Oracle v2 contract tests passed successfully.\n");
    return 0;
}
