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
static int g_ctx_null = 0;

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
    return g_ctx_null ? NULL : &g_mock_block_ctx;
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

static int g_pass = 0, g_fail = 0;
#define CHECK(cond, msg) do { if (cond) { g_pass++; } else { g_fail++; printf("  [FAIL] %s (line %d)\n", msg, __LINE__); } } while (0)
#define T0 1791880000u
typedef struct { int reverted; ulong code; int returned; } res_t;
static res_t run_ix(void const *buf, ulong sz) {
    g_has_reverted = g_has_returned = false; g_last_revert_code = 0;
    if (setjmp(g_test_jmp) == 0) oracle_contract_start(buf, sz);
    res_t r = { g_has_reverted, g_last_revert_code, g_has_returned };
    return r;
}
static oracle_account_data_t *D(void) { return (oracle_account_data_t *)g_accounts[2].data; }
static void set_clock(uint32_t s) { g_mock_block_ctx.block_time = (uint64_t)s * 1000000000ULL; }
static oracle_entry_t mk(uint32_t sym, q64_t p, uint32_t ts) {
    oracle_entry_t e; memset(&e, 0, sizeof e); e.symbol_id = sym;
    e.price_q64_hi = (uint64_t)(p >> 64); e.price_q64_lo = (uint64_t)p; e.timestamp = ts; return e;
}
static uint8_t g_buf[sizeof(oracle_update_hdr_t) + 40 * sizeof(oracle_entry_t)];
static res_t send(uint32_t type, uint32_t regime, uint32_t hdr_ts, uint32_t n, oracle_entry_t const *es) {
    oracle_update_hdr_t *h = (oracle_update_hdr_t *)g_buf; memset(g_buf, 0, sizeof g_buf);
    h->instruction_type = type; h->oracle_account_idx = 2; h->regime_id = regime; h->timestamp = hdr_ts; h->entry_count = n;
    if (n) memcpy(g_buf + sizeof *h, es, (size_t)n * sizeof(oracle_entry_t));
    return run_ix(g_buf, sizeof *h + (ulong)n * sizeof(oracle_entry_t));
}
static res_t upd1(uint32_t sym, long price, uint32_t ts) { oracle_entry_t e = mk(sym, q64_from_int(price), ts); return send(ORACLE_INSTR_UPDATE_PRICES, 1, ts, 1, &e); }
static res_t reb1(uint32_t sym, long price, uint32_t ts) { oracle_entry_t e = mk(sym, q64_from_int(price), ts); return send(ORACLE_INSTR_REBASE, 1, ts, 1, &e); }
static long stored(int i) { return (long)q64_to_int(((q64_t)D()->entries[i].price_q64_hi << 64) | D()->entries[i].price_q64_lo); }
static void fresh(void) {
    reset_mock_env(); set_clock(T0 + 5); g_ctx_null = 0;
    oracle_init_args_t ia; memset(&ia, 0, sizeof ia); ia.instruction_type = ORACLE_INSTR_INITIALIZE; ia.oracle_account_idx = 2;
    run_ix(&ia, sizeof ia);
    res_t r = upd1(1, 80000, T0 + 5); CHECK(r.returned && stored(0) == 80000, "baseline accepted");
}
static void trip(void) { set_clock(T0 + 15); res_t r = upd1(1, 90000, T0 + 15); CHECK(r.returned && D()->circuit_breaker_active == 1 && stored(0) == 80000, "trip leaves baseline untouched"); }

int main(void) {
    printf("=== PHASE-7 HARDENING TESTS (patched oracle) ===\n");
    res_t r;

    /* H1 lockout fixed */
    fresh(); trip();
    set_clock(T0 + 20); r = reb1(1, 90000, T0 + 20);
    CHECK(r.returned && D()->circuit_breaker_active == 0 && stored(0) == 90000 && D()->last_update_ts == T0 + 20, "H1 REBASE re-baselines to 90000 and clears breaker");
    set_clock(T0 + 30); r = upd1(1, 90500, T0 + 30);
    CHECK(r.returned && D()->circuit_breaker_active == 0 && stored(0) == 90500, "H1 oracle follows the market after rebase (no re-trip)");

    /* H2/H3 rebase guards */
    fresh(); r = reb1(1, 90000, T0 + 6); CHECK(r.reverted && r.code == ORACLE_ERR_NOT_TRIPPED, "H2 REBASE while NOT tripped -> 0x2011");
    fresh(); trip(); memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x99, 32); set_clock(T0 + 20); r = reb1(1, 90000, T0 + 20);
    CHECK(r.reverted && r.code == ORACLE_ERR_UNAUTHORIZED && D()->circuit_breaker_active == 1 && stored(0) == 80000, "H3 unauthorized REBASE -> 0x2003, state intact");
    fresh(); trip(); set_clock(T0 + 20); r = upd1(1, 80100, T0 + 20); CHECK(r.reverted && r.code == ORACLE_ERR_CIRCUIT_BREAKER, "H4 UPDATE while tripped -> 0x2007");

    /* H5 clock fail-closed */
    fresh(); g_ctx_null = 1; r = upd1(1, 80100, T0 + 6); CHECK(r.reverted && r.code == ORACLE_ERR_CLOCK_UNAVAILABLE && stored(0) == 80000, "H5a NULL block ctx -> 0x200D");
    fresh(); g_mock_block_ctx.block_time = 0; r = upd1(1, 80100, 4000000000u); CHECK(r.reverted && r.code == ORACLE_ERR_CLOCK_UNAVAILABLE && D()->last_update_ts == T0 + 5, "H5b block_time==0 -> 0x200D (year-2096 ts rejected)");

    /* H6 per-entry timestamps */
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 11); r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_ENTRY_TIMESTAMP, "H6a entry ts > header ts -> 0x200E");
    fresh(); set_clock(T0 + 130); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 9); r = send(1, 1, T0 + 130, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_ENTRY_TIMESTAMP, "H6b entry older than 120s vs header -> 0x200E");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 8); r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_ENTRY_TIMESTAMP, "H6c header != max(entry ts) -> 0x200E");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 4); r = send(1, 1, T0 + 5, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_ENTRY_TIMESTAMP, "H6d per-symbol ts regression -> 0x200E");
    fresh(); set_clock(T0 + 10); r = upd1(1, 80000, 1); CHECK(r.reverted, "H6e entry/header ts=1 (PoC-B) rejected");

    /* H7 capacity: no silent drop */
    fresh(); { oracle_entry_t es[32]; for (uint32_t i = 0; i < 32; i++) es[i] = mk(i + 1, q64_from_int(80000), T0 + 5); r = send(1, 1, T0 + 5, 32, es); }
    CHECK(r.returned && D()->entry_count == 32, "H7a 32 distinct symbols fill the book");
    fresh(); { oracle_entry_t es[32]; for (uint32_t i = 0; i < 32; i++) es[i] = mk(i + 1, q64_from_int(80000), T0 + 5); es[0].symbol_id = 1; r = send(1, 1, T0 + 5, 32, es); }
    set_clock(T0 + 6); { uint32_t before = D()->last_update_ts; oracle_entry_t e = mk(33, q64_from_int(100), T0 + 6); r = send(1, 1, T0 + 6, 1, &e);
      CHECK(r.reverted && r.code == ORACLE_ERR_SYMBOL_CAPACITY && D()->last_update_ts == before && D()->entry_count == 32, "H7b symbol #33 -> 0x200F, nothing written (PoC-D)"); }

    /* H8 error-path matrix: every documented oracle code is now asserted */
    fresh(); { uint8_t tiny[3] = {1,0,0}; r = run_ix(tiny, 3); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_INSTR_SIZE, "H8 0x2001 short payload");
    fresh(); { uint32_t bad = 9; uint8_t b[8]; memcpy(b, &bad, 4); memset(b + 4, 0, 4); r = run_ix(b, 8); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_INSTR_TYPE, "H8 0x2002 unknown instruction");
    fresh(); memset(g_mock_txn.hdr.v1.fee_payer_pubkey.uc, 0x99, 32); r = upd1(1, 80100, T0 + 6); CHECK(r.reverted && r.code == ORACLE_ERR_UNAUTHORIZED, "H8 0x2003 unauthorized update");
    fresh(); { oracle_entry_t e = mk(1, q64_from_int(1), T0 + 5); oracle_update_hdr_t *h; send(1, 1, T0 + 5, 1, &e); h = (oracle_update_hdr_t *)g_buf; h->oracle_account_idx = 5; r = run_ix(g_buf, sizeof *h + sizeof e); } CHECK(r.reverted && r.code == ORACLE_ERR_DATA_ACCESS_FAILED, "H8 0x2004 missing account");
    fresh(); r = send(1, 1, T0 + 5, 0, NULL); CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_COUNT, "H8 0x2006 count 0");
    fresh(); { oracle_entry_t es[33]; for (int i = 0; i < 33; i++) es[i] = mk(i + 1, q64_from_int(1), T0 + 5); r = send(1, 1, T0 + 5, 33, es); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_COUNT, "H8 0x2006 count 33");
    fresh(); { oracle_init_args_t ia; memset(&ia, 0, sizeof ia); ia.instruction_type = 0; ia.oracle_account_idx = 2; r = run_ix(&ia, sizeof ia); } CHECK(r.reverted && r.code == ORACLE_ERR_ALREADY_INITIALIZED, "H8 0x2008 re-init");
    fresh(); set_clock(T0 + 20); r = upd1(1, 80100, T0 + 4); CHECK(r.reverted && r.code == ORACLE_ERR_STALE_TIMESTAMP, "H8 0x2009 header older than last update");
    fresh(); set_clock(T0 + 200); r = upd1(1, 80100, T0 + 70); CHECK(r.reverted && r.code == ORACLE_ERR_STALE_TIMESTAMP, "H8 0x2009 header >120s behind block time");
    fresh(); set_clock(T0 + 10); r = upd1(1, 80100, T0 + 41); CHECK(r.reverted && r.code == ORACLE_ERR_FUTURE_SKEW, "H8 0x200A future skew >30s");
    fresh(); set_clock(T0 + 10); { oracle_entry_t es[2] = { mk(1, q64_from_int(1), T0 + 10), mk(1, q64_from_int(2), T0 + 10) }; r = send(1, 1, T0 + 10, 2, es); } CHECK(r.reverted && r.code == ORACLE_ERR_DUPLICATE_SYMBOL, "H8 0x200B duplicate symbol");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, 0, T0 + 10); r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_PRICE, "H8 0x200C zero price");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, 1, T0 + 10); e.price_q64_hi = 1ULL << 63; r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_PRICE, "H8 0x200C sign-bit price (hi>=2^63)");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(0, q64_from_int(5), T0 + 10); r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_SYMBOL, "H8 0x2010 symbol 0");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(5), T0 + 10); r = send(1, 4, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_REGIME, "H8 0x2012 regime 4");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 10); e.volatility_bps = 10001; r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.reverted && r.code == ORACLE_ERR_INVALID_VOLATILITY, "H8 0x2014 volatility 10001 bps > 10000 max");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 10); e.volatility_bps = 10000; r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.returned && D()->entries[0].volatility_bps == 10000, "H8 10000 bps volatility accepted");
    fresh(); set_clock(T0 + 10); { oracle_entry_t e = mk(1, q64_from_int(80100), T0 + 10); e.volatility_bps = ORACLE_VOLATILITY_UNKNOWN; r = send(1, 1, T0 + 10, 1, &e); } CHECK(r.returned && D()->entries[0].volatility_bps == ORACLE_VOLATILITY_UNKNOWN, "H8 0xFFFFFFFF unknown volatility accepted");

    /* H9 atomicity (mock has NO rollback, so passing proves validate-before-mutate) */
    fresh(); set_clock(T0 + 10); { oracle_entry_t es[2] = { mk(1, q64_from_int(80100), T0 + 10), mk(2, 0, T0 + 10) }; r = send(1, 1, T0 + 10, 2, es); }
    CHECK(r.reverted && stored(0) == 80000 && D()->last_update_ts == T0 + 5 && D()->entry_count == 1, "H9 bad 2nd entry leaves state byte-identical");

    /* H10 exact 500 bps boundary (old code floored bps to an integer: 500.119 bps was NOT tripped) */
    fresh(); set_clock(T0 + 10); r = upd1(1, 84000, T0 + 10); CHECK(r.returned && D()->circuit_breaker_active == 0, "H10 setup 84000 (+5.0000%% of 80000 = 500.0 bps exactly) accepted");
    set_clock(T0 + 20); r = upd1(1, 88200, T0 + 20); CHECK(r.returned && D()->circuit_breaker_active == 0 && stored(0) == 88200, "H10a exactly 500.000 bps accepted");
    fresh(); set_clock(T0 + 10); upd1(1, 84000, T0 + 10); set_clock(T0 + 20); r = upd1(1, 88201, T0 + 20); CHECK(r.returned && D()->circuit_breaker_active == 1, "H10b 500.119 bps trips (exact comparison)");

    printf("\nRESULT: %d passed, %d failed\n", g_pass, g_fail);
    return g_fail ? 1 : 0;
}
