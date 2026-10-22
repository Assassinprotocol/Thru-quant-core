#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <setjmp.h>
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
    (void)data; (void)sz;
    return 0UL;
}

#include "../src/v2/oracle_v2.c"

static uint64_t g_rng = 0x853c49e6748fea9bULL;
static inline uint64_t xorshift64(void) {
    uint64_t x = g_rng;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    return g_rng = x;
}

int main(int argc, char **argv) {
    long iterations = 50000L;
    if (argc > 1) {
        long n = strtol(argv[1], NULL, 10);
        if (n > 0) iterations = n;
    }

    printf("=== RUNNING ORACLE V2 ADVERSARIAL FUZZING (%ld iterations) ===\n", iterations);

    memset(g_accounts, 0, sizeof(g_accounts));
    memset(&g_mock_txn, 0, sizeof(g_mock_txn));
    g_mock_block_ctx.slot = 50000;
    g_mock_block_ctx.block_time = 1700000000ULL * 1000000000ULL;

    init_registry_args_t init_args = {
        .opcode = ORACLE_V2_OP_INITIALIZE_REGISTRY,
        .registry_acc_idx = 0,
        .admin_m = 3,
        .admin_n = 5,
        .min_publishers = 3
    };
    for (int i = 0; i < 5; i++) memset(init_args.admin_keys[i], i + 1, 32);

    if (setjmp(g_test_jmp) == 0) {
        start(&init_args, sizeof(init_args));
    }

    memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 1, 32);
    for (uint32_t i = 0; i < 5; i++) {
        set_publisher_args_t p = {
            .opcode = ORACLE_V2_OP_SET_PUBLISHER,
            .registry_acc_idx = 0,
            .status = 1
        };
        memset(p.publisher_pubkey, (int)(i + 10), 32);
        if (setjmp(g_test_jmp) == 0) start(&p, sizeof(p));
    }

    uint8_t payload[2048];
    long reverts = 0;
    long returns = 0;

    for (long i = 0; i < iterations; i++) {
        size_t sz = (size_t)(xorshift64() % 1024);
        for (size_t b = 0; b < sz; b += 8) {
            uint64_t v = xorshift64();
            size_t rem = sz - b;
            memcpy(payload + b, &v, rem < 8 ? rem : 8);
        }

        if (i % 2 == 0) {
            uint32_t opcode = (uint32_t)(xorshift64() % 12);
            memcpy(payload, &opcode, 4);
            if (opcode == ORACLE_V2_OP_SUBMIT_PRICES && sz >= sizeof(submit_prices_hdr_t) + sizeof(raw_quote_t)) {
                submit_prices_hdr_t *hdr = (submit_prices_hdr_t *)payload;
                hdr->registry_acc_idx = 0;
                hdr->submission_acc_idx = (uint16_t)(10 + (xorshift64() % 5));
                hdr->sequence_number = xorshift64();
                hdr->quote_count = 1;
                raw_quote_t *q = (raw_quote_t *)(payload + sizeof(submit_prices_hdr_t));
                q->symbol_id = (uint32_t)(xorshift64() % 8);
                q->price = xorshift64();
                q->source_ts = 1700000000ULL + (xorshift64() % 100) - 50;
            } else if (opcode == ORACLE_V2_OP_AGGREGATE && sz >= sizeof(aggregate_args_t)) {
                aggregate_args_t *agg = (aggregate_args_t *)payload;
                agg->registry_acc_idx = 0;
                agg->feed_acc_idx = (uint16_t)(1 + (xorshift64() % 6));
                agg->symbol_id = (uint32_t)(1 + (xorshift64() % 6));
                for (int p = 0; p < 7; p++) {
                    agg->submission_acc_indices[p] = (uint16_t)(10 + (xorshift64() % 5));
                }
            }
        }

        memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, (int)(xorshift64() % 15), 32);

        g_reverted = false;
        g_returned = false;
        if (setjmp(g_test_jmp) == 0) {
            start(payload, (ulong)sz);
        }

        if (g_reverted) reverts++;
        else if (g_returned) returns++;
    }

    printf("  [OK] %ld iterations completed: %ld safe reverts, %ld valid executions, 0 crashes\n",
           iterations, reverts, returns);
    return 0;
}
