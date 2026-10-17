#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>
#include "market_oracle.h"

static void handle_initialize(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(oracle_init_args_t)) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }

    oracle_init_args_t const *args = (oracle_init_args_t const *)instruction_data;
    ushort acc_idx = args->oracle_account_idx;

    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    /* Reject re-initialization if already active */
    if (tsdk_account_exists(acc_idx)) {
        tsdk_account_meta_t const *existing_meta = tsdk_get_account_meta(acc_idx);
        if (existing_meta->data_sz >= sizeof(oracle_account_data_t)) {
            oracle_account_data_t const *existing = (oracle_account_data_t const *)tsdk_get_account_data_ptr(acc_idx);
            if (existing->version != 0) {
                tsdk_printf("market_oracle: account %u already initialized (version=%u)", acc_idx, existing->version);
                tsdk_revert(ORACLE_ERR_ALREADY_INITIALIZED);
            }
        }
    } else {
        ulong proof_sz = (instruction_data_sz > sizeof(oracle_init_args_t)) ? (instruction_data_sz - sizeof(oracle_init_args_t)) : 0UL;
        void const *proof = (proof_sz > 0UL) ? ((uchar const *)instruction_data + sizeof(oracle_init_args_t)) : NULL;

        ulong create_rc = 0UL;
        if (proof_sz > 0UL && proof != NULL) {
            create_rc = tsys_account_create((ulong)acc_idx, args->seed, proof, proof_sz);
        } else {
            create_rc = tsys_account_create_ephemeral((ulong)acc_idx, args->seed);
        }

        if (create_rc != 0UL) {
            tsdk_printf("market_oracle: account create failed with rc=%lu", create_rc);
            tsdk_revert(ORACLE_ERR_ACCOUNT_INIT_FAILED);
        }
    }

    tsys_set_account_data_writable(acc_idx);

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(oracle_account_data_t)) {
        ulong resize_rc = tsys_account_resize(acc_idx, sizeof(oracle_account_data_t));
        if (resize_rc != 0UL) {
            tsdk_printf("market_oracle: account resize failed with rc=%lu", resize_rc);
            tsdk_revert(ORACLE_ERR_RESIZE_FAILED);
        }
    }

    oracle_account_data_t *data = (oracle_account_data_t *)tsdk_get_account_data_ptr(acc_idx);
    memset(data, 0, sizeof(oracle_account_data_t));
    data->version = 1;
    data->circuit_breaker_active = 0;

    /* Set cryptographic authority to the transaction fee payer */
    memcpy(data->authority_pubkey, tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc, 32);

    tsdk_printf("market_oracle: initialized storage for account %u with fee payer authority", acc_idx);
    tsdk_return(TSDK_SUCCESS);
}

static q64_t entry_price(oracle_entry_t const *e) {
    /* unsigned shift: no signed-overflow UB. Stored prices always satisfy hi < 2^63. */
    return (q64_t)((((uq64_t)e->price_q64_hi) << 64) | (uq64_t)e->price_q64_lo);
}

/* is_rebase=0: UPDATE_PRICES (deviation-checked, needs breaker clear)
 * is_rebase=1: REBASE (authority re-baselines to new market level, needs breaker tripped) */
static void process_update(void const *instruction_data, ulong instruction_data_sz, int is_rebase) {
    if (instruction_data_sz < sizeof(oracle_update_hdr_t)) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }
    oracle_update_hdr_t const *hdr = (oracle_update_hdr_t const *)instruction_data;
    if (hdr->entry_count == 0 || hdr->entry_count > MAX_ORACLE_SYMBOLS) {
        tsdk_revert(ORACLE_ERR_INVALID_COUNT);
    }
    ulong expected_sz = sizeof(oracle_update_hdr_t) + ((ulong)hdr->entry_count * sizeof(oracle_entry_t));
    if (instruction_data_sz != expected_sz) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }
    if (hdr->regime_id > 3U) {
        tsdk_revert(ORACLE_ERR_INVALID_REGIME);
    }

    ushort acc_idx = hdr->oracle_account_idx;
    if (!tsdk_is_account_idx_valid(acc_idx) || !tsdk_account_exists(acc_idx)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }
    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(oracle_account_data_t)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }
    tsys_set_account_data_writable(acc_idx);
    oracle_account_data_t *data = (oracle_account_data_t *)tsdk_get_account_data_ptr(acc_idx);
    if (data->version != 1) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    /* 1. Authority */
    if (memcmp(tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc, data->authority_pubkey, 32) != 0) {
        tsdk_revert(ORACLE_ERR_UNAUTHORIZED);
    }

    /* 2. Breaker gate */
    if (is_rebase) {
        if (data->circuit_breaker_active == 0) tsdk_revert(ORACLE_ERR_NOT_TRIPPED);
    } else if (data->circuit_breaker_active != 0) {
        tsdk_revert(ORACLE_ERR_CIRCUIT_BREAKER);
    }

    /* 3. Block clock check */
    tsdk_block_ctx_t const *blk_ctx = tsdk_get_current_block_ctx();
    if (blk_ctx == NULL || blk_ctx->block_time == 0UL) {
        tsdk_revert(ORACLE_ERR_CLOCK_UNAVAILABLE);
    }
    uint32_t now_s = (uint32_t)(blk_ctx->block_time / 1000000000ULL);
    if (hdr->timestamp < data->last_update_ts) tsdk_revert(ORACLE_ERR_STALE_TIMESTAMP);
    if (hdr->timestamp > now_s + MAX_FUTURE_SKEW_SECONDS) tsdk_revert(ORACLE_ERR_FUTURE_SKEW);
    if (now_s > hdr->timestamp && (now_s - hdr->timestamp) > MAX_QUOTE_AGE_SECONDS) tsdk_revert(ORACLE_ERR_STALE_TIMESTAMP);

    oracle_entry_t const *incoming = (oracle_entry_t const *)((uchar const *)instruction_data + sizeof(oracle_update_hdr_t));

    /* 4. Validate quotes */
    uint32_t max_ts = 0, new_syms = 0;
    for (uint32_t i = 0; i < hdr->entry_count; i++) {
        oracle_entry_t const *e = &incoming[i];
        if (e->symbol_id == 0) tsdk_revert(ORACLE_ERR_INVALID_SYMBOL);
        if ((e->price_q64_hi == 0 && e->price_q64_lo == 0) || (e->price_q64_hi >> 63) != 0) tsdk_revert(ORACLE_ERR_INVALID_PRICE);
        if (e->timestamp > hdr->timestamp || (hdr->timestamp - e->timestamp) > MAX_QUOTE_AGE_SECONDS) tsdk_revert(ORACLE_ERR_ENTRY_TIMESTAMP);
        if (e->timestamp > max_ts) max_ts = e->timestamp;
        for (uint32_t j = i + 1; j < hdr->entry_count; j++) {
            if (e->symbol_id == incoming[j].symbol_id) tsdk_revert(ORACLE_ERR_DUPLICATE_SYMBOL);
        }
        int found = 0;
        for (uint32_t j = 0; j < data->entry_count; j++) {
            if (data->entries[j].symbol_id == e->symbol_id) {
                found = 1;
                if (e->timestamp < data->entries[j].timestamp) tsdk_revert(ORACLE_ERR_ENTRY_TIMESTAMP);
                break;
            }
        }
        if (!found) new_syms++;
    }
    if (max_ts != hdr->timestamp) tsdk_revert(ORACLE_ERR_ENTRY_TIMESTAMP);
    if (data->entry_count + new_syms > MAX_ORACLE_SYMBOLS) tsdk_revert(ORACLE_ERR_SYMBOL_CAPACITY);

    /* 5. Volatility collar check (UPDATE only) */
    if (!is_rebase) {
        q64_t limit = q64_from_int((int64_t)MAX_ALLOWED_DEVIATION_BPS);
        for (uint32_t i = 0; i < hdr->entry_count; i++) {
            for (uint32_t j = 0; j < data->entry_count; j++) {
                if (data->entries[j].symbol_id != incoming[i].symbol_id) continue;
                q64_t new_p = entry_price(&incoming[i]);
                q64_t old_p = entry_price(&data->entries[j]);
                if (old_p > 0) {
                    q64_t delta = (new_p > old_p) ? (new_p - old_p) : (old_p - new_p);
                    q64_t bps_diff = q64_div(q64_mul(delta, q64_from_int(10000)), old_p);
                    if (bps_diff > limit) {
                        data->circuit_breaker_active = 1;
                        data->regime_id = 3;
                        tsdk_printf("market_oracle: CIRCUIT_BREAKER_TRIPPED sym=%u, delta=%ld bps (limit=%d bps)",
                                    incoming[i].symbol_id, (long)q64_to_int(bps_diff), MAX_ALLOWED_DEVIATION_BPS);
                        tsdk_return(TSDK_SUCCESS);
                    }
                }
                break;
            }
        }
    }

    /* 6. Apply quotes */
    data->regime_id = hdr->regime_id;
    data->last_update_ts = hdr->timestamp;
    for (uint32_t i = 0; i < hdr->entry_count; i++) {
        int found = 0;
        for (uint32_t j = 0; j < data->entry_count; j++) {
            if (data->entries[j].symbol_id == incoming[i].symbol_id) { data->entries[j] = incoming[i]; found = 1; break; }
        }
        if (!found) data->entries[data->entry_count++] = incoming[i];
    }
    if (is_rebase) {
        data->circuit_breaker_active = 0;
        tsdk_printf("market_oracle: REBASED %u quotes, breaker cleared", hdr->entry_count);
    } else {
        tsdk_printf("market_oracle: updated %u quotes, regime=%u, ts=%u", hdr->entry_count, hdr->regime_id, hdr->timestamp);
    }
    tsdk_return(TSDK_SUCCESS);
}

static void handle_update_prices(void const *d, ulong n) { process_update(d, n, 0); }
static void handle_rebase(void const *d, ulong n)        { process_update(d, n, 1); }

static void handle_resume(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(oracle_resume_args_t)) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }

    oracle_resume_args_t const *args = (oracle_resume_args_t const *)instruction_data;
    ushort acc_idx = args->oracle_account_idx;

    if (!tsdk_is_account_idx_valid(acc_idx) || !tsdk_account_exists(acc_idx)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(oracle_account_data_t)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    tsys_set_account_data_writable(acc_idx);
    oracle_account_data_t *data = (oracle_account_data_t *)tsdk_get_account_data_ptr(acc_idx);

    if (data->version != 1) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    /* Authority verification: fee payer must match initialized authority */
    if (memcmp(tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc, data->authority_pubkey, 32) != 0) {
        tsdk_revert(ORACLE_ERR_UNAUTHORIZED);
    }

    data->circuit_breaker_active = 0;
    tsdk_printf("market_oracle: CIRCUIT_BREAKER_RESET by authorized fee payer");
    tsdk_return(TSDK_SUCCESS);
}

TSDK_ENTRYPOINT_FN void start(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(uint32_t)) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }

    uint32_t instr_type = *(uint32_t const *)instruction_data;

    switch (instr_type) {
        case ORACLE_INSTR_INITIALIZE:
            handle_initialize(instruction_data, instruction_data_sz);
            break;
        case ORACLE_INSTR_UPDATE_PRICES:
            handle_update_prices(instruction_data, instruction_data_sz);
            break;
        case ORACLE_INSTR_RESUME:
            handle_resume(instruction_data, instruction_data_sz);
            break;
        case ORACLE_INSTR_REBASE:
            handle_rebase(instruction_data, instruction_data_sz);
            break;
        default:
            tsdk_revert(ORACLE_ERR_INVALID_INSTR_TYPE);
    }

    tsdk_return(TSDK_SUCCESS);
}
