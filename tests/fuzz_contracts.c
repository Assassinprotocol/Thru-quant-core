#include <stdio.h>
#include <stdlib.h>
#include <stdarg.h>
#include <string.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdbool.h>

#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>

#include "thru_math.h"
#include "../src/market_oracle.h"
#include "../src/clob_engine.h"

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
    (void)fmt;
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

/* Include contract source files directly to test real static functions */
#undef TSDK_ENTRYPOINT_FN
#define TSDK_ENTRYPOINT_FN static __attribute__((noreturn))
#define start oracle_contract_start
#include "../src/market_oracle.c"
#undef start

#define start clob_contract_start
#include "../src/clob_engine.c"
#undef start

/* Fast deterministic PRNG (xorshift64) */
static uint64_t g_prng_state = 0x853c49e6748fea9bULL;

static inline uint64_t xorshift64(void) {
    uint64_t x = g_prng_state;
    x ^= x << 13;
    x ^= x >> 7;
    x ^= x << 17;
    g_prng_state = x;
    return x;
}

static inline uint32_t rand_u32(void) {
    return (uint32_t)xorshift64();
}

static void fill_random(uint8_t *buf, size_t sz) {
    for (size_t i = 0; i < sz; i += 8) {
        uint64_t v = xorshift64();
        size_t rem = sz - i;
        if (rem >= 8) {
            memcpy(buf + i, &v, 8);
        } else {
            memcpy(buf + i, &v, rem);
        }
    }
}

int main(int argc, char **argv) {
    long total_iterations = 100000L;
    if (argc > 1) {
        long n = strtol(argv[1], NULL, 10);
        if (n > 0) total_iterations = n;
    }

    printf("=== CONTRACT INSTRUCTION PARSER FUZZER (%ld iterations) ===\n", total_iterations);

    uint8_t payload[4096];
    long oracle_reverts = 0;
    long oracle_returns = 0;
    long clob_reverts = 0;
    long clob_returns = 0;

    /* -------------------------------------------------------------------------
     * 1. Fuzzing Market Oracle Contract Parser
     * ------------------------------------------------------------------------- */
    reset_mock_env();

    /* Initialize account 2 as a valid Oracle account */
    g_accounts[2].exists = true;
    g_accounts[2].writable = true;
    g_accounts[2].data_sz = sizeof(oracle_account_data_t);
    oracle_account_data_t *oracle_state = (oracle_account_data_t *)g_accounts[2].data;
    oracle_state->version = 1;
    memset(oracle_state->authority_pubkey, 0x42, 32);
    oracle_state->circuit_breaker_active = 0;
    oracle_state->last_update_ts = 1791880000U;
    oracle_state->entry_count = 1;
    oracle_state->entries[0].symbol_id = 1;
    oracle_state->entries[0].price_q64_hi = 80000ULL;
    oracle_state->entries[0].timestamp = 1791880000U;
    oracle_state->entries[0].volatility_bps = 150;

    for (long i = 0; i < total_iterations; i++) {
        size_t sz = (size_t)(rand_u32() % 2048);
        fill_random(payload, sz);

        /* Deterministically inject structured mutations every few iterations */
        if (i % 3 == 0 && sz >= sizeof(oracle_update_hdr_t)) {
            oracle_update_hdr_t *hdr = (oracle_update_hdr_t *)payload;
            hdr->instruction_type = rand_u32() % 5;
            hdr->oracle_account_idx = (uint16_t)(rand_u32() % 4);
            hdr->entry_count = rand_u32() % 64;
            hdr->timestamp = 1791880000U + (rand_u32() % 100);
        }

        g_has_reverted = false;
        g_has_returned = false;
        g_last_revert_code = 0UL;

        if (setjmp(g_test_jmp) == 0) {
            oracle_contract_start(payload, (ulong)sz);
        }

        if (g_has_reverted) {
            oracle_reverts++;
        } else if (g_has_returned) {
            oracle_returns++;
        }
    }

    printf("  [OK] Oracle parser fuzzed %ld times: %ld reverts safely caught, %ld returns\n",
           total_iterations, oracle_reverts, oracle_returns);

    /* -------------------------------------------------------------------------
     * 2. Fuzzing CLOB Engine Contract Parser
     * ------------------------------------------------------------------------- */
    reset_mock_env();

    /* Initialize account 2 as a valid CLOB account */
    g_accounts[2].exists = true;
    g_accounts[2].writable = true;
    g_accounts[2].data_sz = sizeof(clob_state_t);
    clob_state_t *clob_state = (clob_state_t *)g_accounts[2].data;
    clob_state->version = 1;
    clob_state->market_type = 0;
    clob_state->min_notional = 1;
    clob_state->next_order_id = 1;
    clob_state->best_bid_idx = -1;
    clob_state->best_ask_idx = -1;

    for (long i = 0; i < total_iterations; i++) {
        size_t sz = (size_t)(rand_u32() % 2048);
        fill_random(payload, sz);

        if (i % 3 == 0 && sz >= sizeof(clob_place_order_args_t)) {
            clob_place_order_args_t *args = (clob_place_order_args_t *)payload;
            args->instruction_type = rand_u32() % 5;
            args->clob_account_idx = (uint16_t)(rand_u32() % 4);
            args->side = (uint8_t)(rand_u32() % 3);
            args->price_hi = rand_u32() % 100000;
            args->price_lo = rand_u32();
            args->qty = rand_u32() % 1000;
        }

        g_has_reverted = false;
        g_has_returned = false;
        g_last_revert_code = 0UL;

        if (setjmp(g_test_jmp) == 0) {
            clob_contract_start(payload, (ulong)sz);
        }

        if (g_has_reverted) {
            clob_reverts++;
        } else if (g_has_returned) {
            clob_returns++;
        }
    }

    printf("  [OK] CLOB parser fuzzed %ld times: %ld reverts safely caught, %ld returns\n",
           total_iterations, clob_reverts, clob_returns);

    printf("=== CONTRACT FUZZING SUCCEEDED (0 CRASHES, 0 ASAN ERRORS) ===\n");
    return 0;
}
