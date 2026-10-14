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

    if (!tsdk_account_exists(acc_idx)) {
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
            tsdk_revert(0x3000UL + create_rc);
        }
    }

    tsys_set_account_data_writable(acc_idx);

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(oracle_account_data_t)) {
        ulong resize_rc = tsys_account_resize(acc_idx, sizeof(oracle_account_data_t));
        if (resize_rc != 0UL) {
            tsdk_printf("market_oracle: account resize failed with rc=%lu", resize_rc);
            tsdk_revert(0x4000UL + resize_rc);
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

static void handle_update_prices(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(oracle_update_hdr_t)) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }

    oracle_update_hdr_t const *hdr = (oracle_update_hdr_t const *)instruction_data;
    if (hdr->entry_count > MAX_ORACLE_SYMBOLS) {
        tsdk_revert(ORACLE_ERR_INVALID_COUNT);
    }

    ulong expected_sz = sizeof(oracle_update_hdr_t) + (hdr->entry_count * sizeof(oracle_entry_t));
    if (instruction_data_sz < expected_sz) {
        tsdk_revert(ORACLE_ERR_INVALID_INSTR_SIZE);
    }

    ushort acc_idx = hdr->oracle_account_idx;
    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(ORACLE_ERR_DATA_ACCESS_FAILED);
    }

    tsys_set_account_data_writable(acc_idx);

    oracle_account_data_t *data = (oracle_account_data_t *)tsdk_get_account_data_ptr(acc_idx);

    /* 1. Authority Verification */
    if (memcmp(tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc, data->authority_pubkey, 32) != 0) {
        tsdk_revert(ORACLE_ERR_UNAUTHORIZED);
    }

    data->regime_id = hdr->regime_id;
    data->last_update_ts = hdr->timestamp;

    oracle_entry_t const *incoming = (oracle_entry_t const *)((uchar const *)instruction_data + sizeof(oracle_update_hdr_t));

    /* 2. Circuit Breaker / Volatility Collar Check */
    for (uint32_t i = 0; i < hdr->entry_count; i++) {
        uint32_t sym = incoming[i].symbol_id;
        q64_t new_p = (((q64_t)incoming[i].price_q64_hi) << 64) | ((q64_t)incoming[i].price_q64_lo);

        for (uint32_t j = 0; j < data->entry_count; j++) {
            if (data->entries[j].symbol_id == sym) {
                q64_t old_p = (((q64_t)data->entries[j].price_q64_hi) << 64) | ((q64_t)data->entries[j].price_q64_lo);
                if (old_p > 0) {
                    q64_t delta = (new_p > old_p) ? (new_p - old_p) : (old_p - new_p);
                    q64_t bps_diff = q64_div(q64_mul(delta, q64_from_int(10000)), old_p);
                    if (q64_to_int(bps_diff) > (int64_t)MAX_ALLOWED_DEVIATION_BPS) {
                        data->circuit_breaker_active = 1;
                        tsdk_printf("market_oracle: circuit breaker triggered for sym %u, bps_diff=%ld",
                                    sym, q64_to_int(bps_diff));
                        tsdk_revert(ORACLE_ERR_CIRCUIT_BREAKER);
                    }
                }
                break;
            }
        }
    }

    /* 3. Update Quotes */
    for (uint32_t i = 0; i < hdr->entry_count; i++) {
        uint32_t sym = incoming[i].symbol_id;
        int found = 0;

        for (uint32_t j = 0; j < data->entry_count; j++) {
            if (data->entries[j].symbol_id == sym) {
                data->entries[j] = incoming[i];
                found = 1;
                break;
            }
        }

        if (!found && data->entry_count < MAX_ORACLE_SYMBOLS) {
            data->entries[data->entry_count++] = incoming[i];
        }
    }

    tsdk_printf("market_oracle: updated %u quotes, regime=%u, ts=%u",
                hdr->entry_count, hdr->regime_id, hdr->timestamp);
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
        default:
            tsdk_revert(ORACLE_ERR_INVALID_INSTR_TYPE);
    }

    tsdk_return(TSDK_SUCCESS);
}
