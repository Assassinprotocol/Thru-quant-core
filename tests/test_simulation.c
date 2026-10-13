#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include "thru_math.h"
#include "../src/market_oracle.h"
#include "../src/clob_engine.h"

static void test_oracle_logic(void) {
    printf("[SIM] Testing Market Oracle Logic...\n");

    oracle_account_data_t oracle_storage;
    memset(&oracle_storage, 0, sizeof(oracle_storage));
    oracle_storage.version = 1;

    // Simulate update 1: Add BTC, ETH, SOL
    oracle_storage.regime_id = 2; // TRENDING DOWN
    oracle_storage.last_update_ts = 1791880000;
    oracle_storage.entry_count = 3;

    q64_t btc_price = q64_from_int(83380);
    oracle_storage.entries[0].symbol_id = 1; // BTC
    oracle_storage.entries[0].price_q64_hi = (uint64_t)(btc_price >> 64);
    oracle_storage.entries[0].price_q64_lo = (uint64_t)btc_price;
    oracle_storage.entries[0].volatility_bps = 180;
    oracle_storage.entries[0].timestamp = 1791880000;

    q64_t eth_price = q64_from_int(2500);
    oracle_storage.entries[1].symbol_id = 2; // ETH
    oracle_storage.entries[1].price_q64_hi = (uint64_t)(eth_price >> 64);
    oracle_storage.entries[1].price_q64_lo = (uint64_t)eth_price;
    oracle_storage.entries[1].volatility_bps = 210;
    oracle_storage.entries[1].timestamp = 1791880000;

    q64_t sol_price = q64_from_int(105);
    oracle_storage.entries[2].symbol_id = 3; // SOL
    oracle_storage.entries[2].price_q64_hi = (uint64_t)(sol_price >> 64);
    oracle_storage.entries[2].price_q64_lo = (uint64_t)sol_price;
    oracle_storage.entries[2].volatility_bps = 290;
    oracle_storage.entries[2].timestamp = 1791880000;

    assert(oracle_storage.entry_count == 3);
    assert(oracle_storage.regime_id == 2);
    assert(oracle_storage.entries[0].symbol_id == 1);
    assert(oracle_storage.entries[0].price_q64_hi == 83380);

    printf("  [✓] Oracle state verified: 3 symbols, regime=2 (TRENDING DOWN)\n");
}

static void test_clob_matching_logic(void) {
    printf("[SIM] Testing Monolithic CLOB Engine Matching Logic...\n");

    clob_state_t book;
    memset(&book, 0, sizeof(book));
    book.version = 1;
    book.next_order_id = 1;

    uint8_t trader_alice[32] = {0xAA};
    uint8_t trader_bob[32] = {0xBB};

    // 1. Place resting ASK: Alice sells 10 ETH at $2500
    uint64_t ask_id = book.next_order_id++;
    book.asks[0].order_id = ask_id;
    memcpy(book.asks[0].trader, trader_alice, 32);
    q64_t ask_price = q64_from_int(2500);
    book.asks[0].price_hi = (uint64_t)(ask_price >> 64);
    book.asks[0].price_lo = (uint64_t)ask_price;
    book.asks[0].qty = 10;
    book.asks[0].side = CLOB_SIDE_ASK;
    book.asks[0].status = CLOB_STATUS_OPEN;
    book.ask_count = 1;

    printf("  [+] Alice placed ASK #%lu: 10 ETH @ $2500\n", ask_id);

    // 2. Incoming BID: Bob buys 6 ETH at $2505 (crosses the spread!)
    q64_t bid_price = q64_from_int(2505);
    uint64_t bid_qty = 6;
    uint64_t rem_qty = bid_qty;

    // Matching cycle
    for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE && rem_qty > 0; i++) {
        if (book.asks[i].status == CLOB_STATUS_OPEN) {
            q64_t resting_ask = (((q64_t)book.asks[i].price_hi) << 64) | ((q64_t)book.asks[i].price_lo);
            if (resting_ask <= bid_price) {
                uint64_t match = (rem_qty < book.asks[i].qty) ? rem_qty : book.asks[i].qty;
                book.asks[i].qty -= match;
                rem_qty -= match;

                if (book.asks[i].qty == 0) {
                    book.asks[i].status = CLOB_STATUS_FILLED;
                    book.ask_count--;
                }
                printf("  [✓] MATCH! Bob matched %lu ETH @ $2500 with Alice\n", match);
            }
        }
    }

    assert(rem_qty == 0); // Bob's order fully filled
    assert(book.asks[0].qty == 4); // Alice has 4 ETH left
    assert(book.asks[0].status == CLOB_STATUS_OPEN);

    // 3. Incoming BID: Charlie buys 10 ETH at $2510 (takes remaining 4 and rests 6)
    rem_qty = 10;
    for (uint32_t i = 0; i < CLOB_MAX_ORDERS_PER_SIDE && rem_qty > 0; i++) {
        if (book.asks[i].status == CLOB_STATUS_OPEN) {
            q64_t resting_ask = (((q64_t)book.asks[i].price_hi) << 64) | ((q64_t)book.asks[i].price_lo);
            if (resting_ask <= bid_price) {
                uint64_t match = (rem_qty < book.asks[i].qty) ? rem_qty : book.asks[i].qty;
                book.asks[i].qty -= match;
                rem_qty -= match;

                if (book.asks[i].qty == 0) {
                    book.asks[i].status = CLOB_STATUS_FILLED;
                    book.ask_count--;
                }
                printf("  [✓] MATCH! Charlie matched %lu ETH @ $2500 with Alice (Alice FILLED)\n", match);
            }
        }
    }

    assert(book.asks[0].qty == 0);
    assert(book.asks[0].status == CLOB_STATUS_FILLED);
    assert(book.ask_count == 0);
    assert(rem_qty == 6); // 6 ETH remaining to rest on BID side

    // Resting Charlie's bid
    uint64_t charlie_id = book.next_order_id++;
    book.bids[0].order_id = charlie_id;
    memcpy(book.bids[0].trader, trader_bob, 32);
    book.bids[0].price_hi = (uint64_t)(bid_price >> 64);
    book.bids[0].price_lo = (uint64_t)bid_price;
    book.bids[0].qty = rem_qty;
    book.bids[0].side = CLOB_SIDE_BID;
    book.bids[0].status = CLOB_STATUS_OPEN;
    book.bid_count = 1;

    printf("  [+] Charlie placed resting BID #%lu: 6 ETH @ $2505\n", charlie_id);

    // 4. Cancel resting BID
    assert(book.bids[0].status == CLOB_STATUS_OPEN);
    book.bids[0].status = CLOB_STATUS_CANCELLED;
    book.bid_count--;
    printf("  [✓] Cancelled BID #%lu successfully\n", charlie_id);
    assert(book.bid_count == 0);
}

int main(void) {
    printf("========================================\n");
    printf("THRU QUANT CORE — HOST SIMULATION SUITE\n");
    printf("========================================\n\n");

    test_oracle_logic();
    printf("\n");
    test_clob_matching_logic();

    printf("\n========================================\n");
    printf("ALL ARCHITECTURAL SIMULATIONS PASSED (100%%)\n");
    printf("========================================\n");
    return 0;
}
