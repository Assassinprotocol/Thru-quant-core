#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>
#include "clob_engine.h"

static void handle_init(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(clob_init_args_t)) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_SIZE);
    }

    clob_init_args_t const *args = (clob_init_args_t const *)instruction_data;
    ushort acc_idx = args->clob_account_idx;

    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(clob_state_t)) {
        ulong resize_rc = tsys_account_resize(acc_idx, sizeof(clob_state_t));
        if (resize_rc != 0UL) {
            tsdk_revert(CLOB_ERR_ACCOUNT_INIT_FAILED);
        }
    }

    tsys_set_account_data_writable(acc_idx);

    clob_state_t *state = (clob_state_t *)tsdk_get_account_data_ptr(acc_idx);
    memset(state, 0, sizeof(clob_state_t));
    state->version = 1;
    state->next_order_id = 1;

    tsdk_printf("clob_engine: initialized orderbook on account %u", acc_idx);
    tsdk_return(TSDK_SUCCESS);
}

static void handle_place_limit(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(clob_place_order_args_t)) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_SIZE);
    }

    clob_place_order_args_t const *args = (clob_place_order_args_t const *)instruction_data;
    if (args->qty == 0) {
        tsdk_revert(CLOB_ERR_INVALID_QTY);
    }
    if (args->side != CLOB_SIDE_BID && args->side != CLOB_SIDE_ASK) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_TYPE);
    }

    ushort acc_idx = args->clob_account_idx;
    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    tsys_set_account_data_writable(acc_idx);

    clob_state_t *state = (clob_state_t *)tsdk_get_account_data_ptr(acc_idx);
    tn_pubkey_t const *fee_payer = &tsdk_get_txn()->hdr.v1.fee_payer_pubkey;
    uint32_t cur_ts = (uint32_t)(tsdk_get_current_block_ctx()->slot);

    q64_t in_price = (((q64_t)args->price_hi) << 64) | ((q64_t)args->price_lo);
    uint64_t rem_qty = args->qty;

    if (args->side == CLOB_SIDE_BID) {
        /* Match against resting ASKS */
        for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE && rem_qty > 0; i++) {
            if (state->asks[i].status == CLOB_STATUS_OPEN) {
                q64_t ask_price = (((q64_t)state->asks[i].price_hi) << 64) | ((q64_t)state->asks[i].price_lo);
                if (ask_price <= in_price) {
                    uint64_t match_qty = (rem_qty < state->asks[i].qty) ? rem_qty : state->asks[i].qty;
                    state->asks[i].qty -= match_qty;
                    rem_qty -= match_qty;

                    if (state->asks[i].qty == 0) {
                        state->asks[i].status = CLOB_STATUS_FILLED;
                        if (state->ask_count > 0) state->ask_count--;
                    }
                    tsdk_printf("clob_engine: matched BID with ASK %lu, matched_qty=%lu",
                                state->asks[i].order_id, match_qty);
                }
            }
        }

        /* Place resting BID if quantity remains */
        if (rem_qty > 0) {
            int placed = 0;
            for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
                if (state->bids[i].status != CLOB_STATUS_OPEN) {
                    state->bids[i].order_id = state->next_order_id++;
                    memcpy(state->bids[i].trader, fee_payer->uc, 32);
                    state->bids[i].price_hi = args->price_hi;
                    state->bids[i].price_lo = args->price_lo;
                    state->bids[i].qty = rem_qty;
                    state->bids[i].side = CLOB_SIDE_BID;
                    state->bids[i].status = CLOB_STATUS_OPEN;
                    state->bids[i].timestamp = cur_ts;
                    state->bid_count++;
                    placed = 1;
                    tsdk_printf("clob_engine: resting BID placed id=%lu, qty=%lu",
                                state->bids[i].order_id, rem_qty);
                    break;
                }
            }
            if (!placed) {
                tsdk_revert(CLOB_ERR_BOOK_FULL);
            }
        }
    } else {
        /* Match against resting BIDS */
        for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE && rem_qty > 0; i++) {
            if (state->bids[i].status == CLOB_STATUS_OPEN) {
                q64_t bid_price = (((q64_t)state->bids[i].price_hi) << 64) | ((q64_t)state->bids[i].price_lo);
                if (bid_price >= in_price) {
                    uint64_t match_qty = (rem_qty < state->bids[i].qty) ? rem_qty : state->bids[i].qty;
                    state->bids[i].qty -= match_qty;
                    rem_qty -= match_qty;

                    if (state->bids[i].qty == 0) {
                        state->bids[i].status = CLOB_STATUS_FILLED;
                        if (state->bid_count > 0) state->bid_count--;
                    }
                    tsdk_printf("clob_engine: matched ASK with BID %lu, matched_qty=%lu",
                                state->bids[i].order_id, match_qty);
                }
            }
        }

        /* Place resting ASK if quantity remains */
        if (rem_qty > 0) {
            int placed = 0;
            for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
                if (state->asks[i].status != CLOB_STATUS_OPEN) {
                    state->asks[i].order_id = state->next_order_id++;
                    memcpy(state->asks[i].trader, fee_payer->uc, 32);
                    state->asks[i].price_hi = args->price_hi;
                    state->asks[i].price_lo = args->price_lo;
                    state->asks[i].qty = rem_qty;
                    state->asks[i].side = CLOB_SIDE_ASK;
                    state->asks[i].status = CLOB_STATUS_OPEN;
                    state->asks[i].timestamp = cur_ts;
                    state->ask_count++;
                    placed = 1;
                    tsdk_printf("clob_engine: resting ASK placed id=%lu, qty=%lu",
                                state->asks[i].order_id, rem_qty);
                    break;
                }
            }
            if (!placed) {
                tsdk_revert(CLOB_ERR_BOOK_FULL);
            }
        }
    }

    tsdk_return(TSDK_SUCCESS);
}

static void handle_cancel(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(clob_cancel_order_args_t)) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_SIZE);
    }

    clob_cancel_order_args_t const *args = (clob_cancel_order_args_t const *)instruction_data;
    ushort acc_idx = args->clob_account_idx;

    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    tsys_set_account_data_writable(acc_idx);

    clob_state_t *state = (clob_state_t *)tsdk_get_account_data_ptr(acc_idx);
    tn_pubkey_t const *fee_payer = &tsdk_get_txn()->hdr.v1.fee_payer_pubkey;

    for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        if (state->bids[i].status == CLOB_STATUS_OPEN && state->bids[i].order_id == args->order_id) {
            if (memcmp(state->bids[i].trader, fee_payer->uc, 32) != 0) {
                tsdk_revert(CLOB_ERR_UNAUTHORIZED);
            }
            state->bids[i].status = CLOB_STATUS_CANCELLED;
            if (state->bid_count > 0) state->bid_count--;
            tsdk_printf("clob_engine: cancelled BID id=%lu", args->order_id);
            tsdk_return(TSDK_SUCCESS);
        }
    }

    for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        if (state->asks[i].status == CLOB_STATUS_OPEN && state->asks[i].order_id == args->order_id) {
            if (memcmp(state->asks[i].trader, fee_payer->uc, 32) != 0) {
                tsdk_revert(CLOB_ERR_UNAUTHORIZED);
            }
            state->asks[i].status = CLOB_STATUS_CANCELLED;
            if (state->ask_count > 0) state->ask_count--;
            tsdk_printf("clob_engine: cancelled ASK id=%lu", args->order_id);
            tsdk_return(TSDK_SUCCESS);
        }
    }

    tsdk_revert(CLOB_ERR_ORDER_NOT_FOUND);
}

TSDK_ENTRYPOINT_FN void start(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(uint32_t)) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_SIZE);
    }

    uint32_t instr_type = *(uint32_t const *)instruction_data;

    switch (instr_type) {
        case CLOB_INSTR_INIT:
            handle_init(instruction_data, instruction_data_sz);
            break;
        case CLOB_INSTR_PLACE_LIMIT:
            handle_place_limit(instruction_data, instruction_data_sz);
            break;
        case CLOB_INSTR_CANCEL:
            handle_cancel(instruction_data, instruction_data_sz);
            break;
        default:
            tsdk_revert(CLOB_ERR_INVALID_INSTR_TYPE);
    }

    tsdk_return(TSDK_SUCCESS);
}
