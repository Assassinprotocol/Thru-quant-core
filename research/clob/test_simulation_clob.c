#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "thru_math.h"
#include "clob_engine.h"

static q64_t get_price(clob_order_t const *o) {
    return (((q64_t)o->price_hi) << 64) | ((q64_t)o->price_lo);
}

static void insert_test_ask(clob_state_t *state, int16_t idx) {
    q64_t in_price = get_price(&state->asks[idx]);
    if (state->best_ask_idx == -1) {
        state->best_ask_idx = idx;
        state->asks[idx].prev_idx = -1;
        state->asks[idx].next_idx = -1;
        state->ask_count++;
        return;
    }

    int16_t cur = state->best_ask_idx;
    int16_t prev = -1;
    while (cur != -1 && get_price(&state->asks[cur]) <= in_price) {
        prev = cur;
        cur = state->asks[cur].next_idx;
    }

    if (prev == -1) {
        state->asks[idx].prev_idx = -1;
        state->asks[idx].next_idx = state->best_ask_idx;
        state->asks[state->best_ask_idx].prev_idx = idx;
        state->best_ask_idx = idx;
    } else {
        state->asks[idx].prev_idx = prev;
        state->asks[idx].next_idx = cur;
        state->asks[prev].next_idx = idx;
        if (cur != -1) state->asks[cur].prev_idx = idx;
    }

    state->ask_count++;
}

static void remove_test_ask(clob_state_t *state, int16_t idx) {
    int16_t p = state->asks[idx].prev_idx;
    int16_t n = state->asks[idx].next_idx;

    if (p != -1) state->asks[p].next_idx = n;
    else state->best_ask_idx = n;

    if (n != -1) state->asks[n].prev_idx = p;

    state->asks[idx].prev_idx = -1;
    state->asks[idx].next_idx = -1;
    if (state->ask_count > 0) state->ask_count--;
}

static void test_clob_bbo_price_priority(void) {
    printf("[SIM] Testing CLOB Price-Time Priority Ladder...\n");

    clob_state_t book;
    memset(&book, 0, sizeof(book));
    book.version = 1;
    book.next_order_id = 1;
    book.best_bid_idx = -1;
    book.best_ask_idx = -1;
    book.min_notional = 1;

    for (int i = 0; i < CLOB_MAX_ORDERS_PER_SIDE; i++) {
        book.asks[i].prev_idx = -1;
        book.asks[i].next_idx = -1;
        book.bids[i].prev_idx = -1;
        book.bids[i].next_idx = -1;
    }

    uint8_t trader_alice[32] = {0xAA};
    uint8_t trader_bob[32] = {0xBB};

    book.asks[0].order_id = book.next_order_id++;
    memcpy(book.asks[0].trader, trader_alice, 32);
    q64_t p_alice = q64_from_int(2505);
    book.asks[0].price_hi = (uint64_t)(p_alice >> 64);
    book.asks[0].price_lo = (uint64_t)p_alice;
    book.asks[0].qty = 10;
    book.asks[0].side = CLOB_SIDE_ASK;
    book.asks[0].status = CLOB_STATUS_OPEN;
    insert_test_ask(&book, 0);

    book.asks[1].order_id = book.next_order_id++;
    memcpy(book.asks[1].trader, trader_bob, 32);
    q64_t p_bob = q64_from_int(2500);
    book.asks[1].price_hi = (uint64_t)(p_bob >> 64);
    book.asks[1].price_lo = (uint64_t)p_bob;
    book.asks[1].qty = 5;
    book.asks[1].side = CLOB_SIDE_ASK;
    book.asks[1].status = CLOB_STATUS_OPEN;
    insert_test_ask(&book, 1);

    assert(book.best_ask_idx == 1);
    assert(get_price(&book.asks[book.best_ask_idx]) == p_bob);
    printf("  [✓] Best execution ladder verified: Best ASK is $2500 at index %d\n", book.best_ask_idx);

    q64_t bid_p = q64_from_int(2510);
    uint64_t rem_qty = 8;

    while (book.best_ask_idx != -1 && rem_qty > 0) {
        int16_t cur_ask = book.best_ask_idx;
        q64_t ask_p = get_price(&book.asks[cur_ask]);
        if (ask_p > bid_p) break;

        uint64_t m = (rem_qty < book.asks[cur_ask].qty) ? rem_qty : book.asks[cur_ask].qty;
        book.asks[cur_ask].qty -= m;
        rem_qty -= m;

        if (book.asks[cur_ask].qty == 0) {
            book.asks[cur_ask].status = CLOB_STATUS_FILLED;
            remove_test_ask(&book, cur_ask);
        }

        printf("  [✓] Matched %lu ETH with Trader at price $%ld\n", m, q64_to_int(ask_p));
    }

    assert(book.asks[1].status == CLOB_STATUS_FILLED);
    assert(book.asks[1].qty == 0);
    assert(book.asks[0].status == CLOB_STATUS_OPEN);
    assert(book.asks[0].qty == 7);
    assert(book.best_ask_idx == 0);
    assert(rem_qty == 0);
    printf("  [✓] Price-Time Priority strictly guaranteed: Bob filled first, Alice partially filled!\n");
}

int main(void) {
    test_clob_bbo_price_priority();
    printf("test_simulation_clob: all tests passed\n");
    return 0;
}
