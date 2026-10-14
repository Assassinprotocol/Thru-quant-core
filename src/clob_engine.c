#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>
#include "clob_engine.h"

static inline q64_t get_order_price(clob_order_t const *o) {
    return (((q64_t)o->price_hi) << 64) | ((q64_t)o->price_lo);
}

static void remove_bid_node(clob_state_t *state, int16_t idx) {
    int16_t p = state->bids[idx].prev_idx;
    int16_t n = state->bids[idx].next_idx;

    if (p != -1) {
        state->bids[p].next_idx = n;
    } else {
        state->best_bid_idx = n;
    }

    if (n != -1) {
        state->bids[n].prev_idx = p;
    }

    state->bids[idx].prev_idx = -1;
    state->bids[idx].next_idx = -1;
    if (state->bid_count > 0) state->bid_count--;
}

static void remove_ask_node(clob_state_t *state, int16_t idx) {
    int16_t p = state->asks[idx].prev_idx;
    int16_t n = state->asks[idx].next_idx;

    if (p != -1) {
        state->asks[p].next_idx = n;
    } else {
        state->best_ask_idx = n;
    }

    if (n != -1) {
        state->asks[n].prev_idx = p;
    }

    state->asks[idx].prev_idx = -1;
    state->asks[idx].next_idx = -1;
    if (state->ask_count > 0) state->ask_count--;
}

/* Insert BID into sorted doubly-linked list (Descending price order, FIFO tie-breaker) */
static void insert_sorted_bid(clob_state_t *state, int16_t idx) {
    q64_t in_price = get_order_price(&state->bids[idx]);

    if (state->best_bid_idx == -1) {
        state->best_bid_idx = idx;
        state->bids[idx].prev_idx = -1;
        state->bids[idx].next_idx = -1;
        state->bid_count++;
        return;
    }

    int16_t cur = state->best_bid_idx;
    int16_t prev = -1;

    while (cur != -1 && get_order_price(&state->bids[cur]) >= in_price) {
        prev = cur;
        cur = state->bids[cur].next_idx;
    }

    if (prev == -1) {
        /* New highest bid */
        state->bids[idx].prev_idx = -1;
        state->bids[idx].next_idx = state->best_bid_idx;
        state->bids[state->best_bid_idx].prev_idx = idx;
        state->best_bid_idx = idx;
    } else {
        state->bids[idx].prev_idx = prev;
        state->bids[idx].next_idx = cur;
        state->bids[prev].next_idx = idx;
        if (cur != -1) {
            state->bids[cur].prev_idx = idx;
        }
    }
    state->bid_count++;
}

/* Insert ASK into sorted doubly-linked list (Ascending price order, FIFO tie-breaker) */
static void insert_sorted_ask(clob_state_t *state, int16_t idx) {
    q64_t in_price = get_order_price(&state->asks[idx]);

    if (state->best_ask_idx == -1) {
        state->best_ask_idx = idx;
        state->asks[idx].prev_idx = -1;
        state->asks[idx].next_idx = -1;
        state->ask_count++;
        return;
    }

    int16_t cur = state->best_ask_idx;
    int16_t prev = -1;

    while (cur != -1 && get_order_price(&state->asks[cur]) <= in_price) {
        prev = cur;
        cur = state->asks[cur].next_idx;
    }

    if (prev == -1) {
        /* New lowest ask */
        state->asks[idx].prev_idx = -1;
        state->asks[idx].next_idx = state->best_ask_idx;
        state->asks[state->best_ask_idx].prev_idx = idx;
        state->best_ask_idx = idx;
    } else {
        state->asks[idx].prev_idx = prev;
        state->asks[idx].next_idx = cur;
        state->asks[prev].next_idx = idx;
        if (cur != -1) {
            state->asks[cur].prev_idx = idx;
        }
    }
    state->ask_count++;
}

static void handle_init(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(clob_init_args_t)) {
        tsdk_revert(CLOB_ERR_INVALID_INSTR_SIZE);
    }

    clob_init_args_t const *args = (clob_init_args_t const *)instruction_data;
    ushort acc_idx = args->clob_account_idx;

    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    /* Multi-layer account existence and anti-state-wipe guard */
    if (tsdk_account_exists(acc_idx)) {
        tsdk_account_meta_t const *existing_meta = tsdk_get_account_meta(acc_idx);
        if (existing_meta->data_sz >= sizeof(clob_state_t)) {
            clob_state_t const *existing = (clob_state_t const *)tsdk_get_account_data_ptr(acc_idx);
            if (existing->version != 0) {
                tsdk_printf("clob_engine: account %u already initialized (version=%u)", acc_idx, existing->version);
                tsdk_revert(CLOB_ERR_ALREADY_INITIALIZED);
            }
        }
    } else {
        ulong proof_sz = (instruction_data_sz > sizeof(clob_init_args_t)) ? (instruction_data_sz - sizeof(clob_init_args_t)) : 0UL;
        void const *proof = (proof_sz > 0UL) ? ((uchar const *)instruction_data + sizeof(clob_init_args_t)) : NULL;

        ulong create_rc = 0UL;
        if (proof_sz > 0UL && proof != NULL) {
            create_rc = tsys_account_create((ulong)acc_idx, args->seed, proof, proof_sz);
        } else {
            create_rc = tsys_account_create_ephemeral((ulong)acc_idx, args->seed);
        }

        if (create_rc != 0UL) {
            tsdk_printf("clob_engine: account create failed with rc=%lu", create_rc);
            tsdk_revert(CLOB_ERR_ACCOUNT_INIT_FAILED);
        }
    }

    tsys_set_account_data_writable(acc_idx);

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(clob_state_t)) {
        ulong resize_rc = tsys_account_resize(acc_idx, sizeof(clob_state_t));
        if (resize_rc != 0UL) {
            tsdk_printf("clob_engine: account resize failed with rc=%lu", resize_rc);
            tsdk_revert(CLOB_ERR_ACCOUNT_INIT_FAILED);
        }
    }

    clob_state_t *state = (clob_state_t *)tsdk_get_account_data_ptr(acc_idx);
    memset(state, 0, sizeof(clob_state_t));
    state->version = 1;
    state->next_order_id = 1;
    state->best_bid_idx = -1;
    state->best_ask_idx = -1;
    state->min_notional = 1; /* Minimum notional: $1 USD */

    for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        state->bids[i].prev_idx = -1;
        state->bids[i].next_idx = -1;
        state->asks[i].prev_idx = -1;
        state->asks[i].next_idx = -1;
    }

    tsdk_printf("clob_engine: initialized BBO orderbook on account %u", acc_idx);
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
    if (!tsdk_is_account_idx_valid(acc_idx) || !tsdk_account_exists(acc_idx)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    tsdk_account_meta_t const *meta = tsdk_get_account_meta(acc_idx);
    if (meta->data_sz < sizeof(clob_state_t)) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    tsys_set_account_data_writable(acc_idx);

    clob_state_t *state = (clob_state_t *)tsdk_get_account_data_ptr(acc_idx);
    if (state->version != 1) {
        tsdk_revert(CLOB_ERR_DATA_ACCESS_FAILED);
    }

    q64_t in_price = (((q64_t)args->price_hi) << 64) | ((q64_t)args->price_lo);
    if (in_price <= 0) {
        tsdk_revert(CLOB_ERR_INVALID_PRICE);
    }

    /* Anti-DoS Min Notional Gate */
    q64_t notional = q64_mul(in_price, q64_from_int((int64_t)args->qty));
    q64_t min_notional_q64 = q64_from_int((int64_t)state->min_notional);
    if (notional < min_notional_q64) {
        tsdk_printf("clob_engine: notional %ld below min %lu", q64_to_int(notional), state->min_notional);
        tsdk_revert(CLOB_ERR_NOTIONAL_TOO_LOW);
    }

    tn_pubkey_t const *fee_payer = &tsdk_get_txn()->hdr.v1.fee_payer_pubkey;
    uint32_t cur_ts = (uint32_t)(tsdk_get_current_block_ctx()->slot);
    uint64_t rem_qty = args->qty;

    if (args->side == CLOB_SIDE_BID) {
        /* O(1) BBO Priority Match against ASKs */
        while (state->best_ask_idx != -1 && rem_qty > 0) {
            int16_t cur_ask = state->best_ask_idx;
            q64_t ask_price = get_order_price(&state->asks[cur_ask]);

            if (ask_price > in_price) {
                break; /* No more crossing orders */
            }

            uint64_t match_qty = (rem_qty < state->asks[cur_ask].qty) ? rem_qty : state->asks[cur_ask].qty;
            state->asks[cur_ask].qty -= match_qty;
            rem_qty -= match_qty;

            if (state->asks[cur_ask].qty == 0) {
                state->asks[cur_ask].status = CLOB_STATUS_FILLED;
                remove_ask_node(state, cur_ask);
            }

            tsdk_printf("clob_engine: matched BID with ASK %lu, matched_qty=%lu",
                        state->asks[cur_ask].order_id, match_qty);
        }

        /* Place resting BID if quantity remains */
        if (rem_qty > 0) {
            int placed_idx = -1;
            for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
                if (state->bids[i].status != CLOB_STATUS_OPEN) {
                    placed_idx = i;
                    break;
                }
            }

            if (placed_idx == -1) {
                tsdk_revert(CLOB_ERR_BOOK_FULL);
            }

            state->bids[placed_idx].order_id = state->next_order_id++;
            memcpy(state->bids[placed_idx].trader, fee_payer->uc, 32);
            state->bids[placed_idx].price_hi = args->price_hi;
            state->bids[placed_idx].price_lo = args->price_lo;
            state->bids[placed_idx].qty = rem_qty;
            state->bids[placed_idx].side = CLOB_SIDE_BID;
            state->bids[placed_idx].status = CLOB_STATUS_OPEN;
            state->bids[placed_idx].timestamp = cur_ts;

            insert_sorted_bid(state, (int16_t)placed_idx);

            tsdk_printf("clob_engine: resting BID placed id=%lu, qty=%lu, idx=%d",
                        state->bids[placed_idx].order_id, rem_qty, placed_idx);
        }
    } else {
        /* O(1) BBO Priority Match against BIDs */
        while (state->best_bid_idx != -1 && rem_qty > 0) {
            int16_t cur_bid = state->best_bid_idx;
            q64_t bid_price = get_order_price(&state->bids[cur_bid]);

            if (bid_price < in_price) {
                break; /* No more crossing orders */
            }

            uint64_t match_qty = (rem_qty < state->bids[cur_bid].qty) ? rem_qty : state->bids[cur_bid].qty;
            state->bids[cur_bid].qty -= match_qty;
            rem_qty -= match_qty;

            if (state->bids[cur_bid].qty == 0) {
                state->bids[cur_bid].status = CLOB_STATUS_FILLED;
                remove_bid_node(state, cur_bid);
            }

            tsdk_printf("clob_engine: matched ASK with BID %lu, matched_qty=%lu",
                        state->bids[cur_bid].order_id, match_qty);
        }

        /* Place resting ASK if quantity remains */
        if (rem_qty > 0) {
            int placed_idx = -1;
            for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
                if (state->asks[i].status != CLOB_STATUS_OPEN) {
                    placed_idx = i;
                    break;
                }
            }

            if (placed_idx == -1) {
                tsdk_revert(CLOB_ERR_BOOK_FULL);
            }

            state->asks[placed_idx].order_id = state->next_order_id++;
            memcpy(state->asks[placed_idx].trader, fee_payer->uc, 32);
            state->asks[placed_idx].price_hi = args->price_hi;
            state->asks[placed_idx].price_lo = args->price_lo;
            state->asks[placed_idx].qty = rem_qty;
            state->asks[placed_idx].side = CLOB_SIDE_ASK;
            state->asks[placed_idx].status = CLOB_STATUS_OPEN;
            state->asks[placed_idx].timestamp = cur_ts;

            insert_sorted_ask(state, (int16_t)placed_idx);

            tsdk_printf("clob_engine: resting ASK placed id=%lu, qty=%lu, idx=%d",
                        state->asks[placed_idx].order_id, rem_qty, placed_idx);
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

    for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        if (state->bids[i].status == CLOB_STATUS_OPEN && state->bids[i].order_id == args->order_id) {
            if (memcmp(state->bids[i].trader, fee_payer->uc, 32) != 0) {
                tsdk_revert(CLOB_ERR_UNAUTHORIZED);
            }
            state->bids[i].status = CLOB_STATUS_CANCELLED;
            remove_bid_node(state, (int16_t)i);
            tsdk_printf("clob_engine: cancelled BID id=%lu", args->order_id);
            tsdk_return(TSDK_SUCCESS);
        }
    }

    for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        if (state->asks[i].status == CLOB_STATUS_OPEN && state->asks[i].order_id == args->order_id) {
            if (memcmp(state->asks[i].trader, fee_payer->uc, 32) != 0) {
                tsdk_revert(CLOB_ERR_UNAUTHORIZED);
            }
            state->asks[i].status = CLOB_STATUS_CANCELLED;
            remove_ask_node(state, (int16_t)i);
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
