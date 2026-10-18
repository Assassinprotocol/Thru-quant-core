#ifndef CLOB_ENGINE_H
#define CLOB_ENGINE_H

#include <stdint.h>
#include <stdbool.h>
#include "thru_math.h"

#define CLOB_INSTR_INIT         (0U)
#define CLOB_INSTR_PLACE_LIMIT  (1U)
#define CLOB_INSTR_CANCEL       (2U)

#define CLOB_SIDE_BID           (0U)
#define CLOB_SIDE_ASK           (1U)

#define CLOB_STATUS_EMPTY       (0U)
#define CLOB_STATUS_OPEN        (1U)
#define CLOB_STATUS_FILLED      (2U)
#define CLOB_STATUS_CANCELLED   (3U)

#define CLOB_MAX_ORDERS_PER_SIDE (256)

#define CLOB_ERR_INVALID_INSTR_SIZE   (0x3001UL)
#define CLOB_ERR_INVALID_INSTR_TYPE   (0x3002UL)
#define CLOB_ERR_UNAUTHORIZED         (0x3003UL)
#define CLOB_ERR_DATA_ACCESS_FAILED   (0x3004UL)
#define CLOB_ERR_ACCOUNT_INIT_FAILED  (0x3005UL)
#define CLOB_ERR_BOOK_FULL            (0x3006UL)
#define CLOB_ERR_ORDER_NOT_FOUND      (0x3007UL)
#define CLOB_ERR_INVALID_QTY          (0x3008UL)
#define CLOB_ERR_NOTIONAL_TOO_LOW     (0x3009UL)
#define CLOB_ERR_ALREADY_INITIALIZED  (0x300AUL)
#define CLOB_ERR_INVALID_PRICE        (0x300BUL)
#define CLOB_ERR_TRADER_LIMIT         (0x300CUL)

#define CLOB_MAX_ORDERS_PER_TRADER    (8U)



typedef struct __attribute__((packed)) {
    uint64_t order_id;
    uint8_t  trader[32];         /* 32-byte trader public key */
    uint64_t price_hi;          /* Q64.64 price high 64 bits */
    uint64_t price_lo;          /* Q64.64 price low 64 bits */
    uint64_t qty;               /* Order quantity */
    uint8_t  side;              /* 0: BID, 1: ASK */
    uint8_t  status;            /* Status enum */
    uint32_t timestamp;
    int16_t  prev_idx;          /* Intrusive linked-list prev index (-1 = head) */
    int16_t  next_idx;          /* Intrusive linked-list next index (-1 = tail) */
} clob_order_t;

typedef struct __attribute__((packed)) {
    uint32_t version;
    uint8_t  market_type;       /* 0: Signaling Book, 1: Settled Book */
    uint8_t  _reserved[3];
    uint64_t min_notional;      /* Minimum notional value (Anti-DoS gate) */
    uint64_t next_order_id;
    int16_t  best_bid_idx;      /* Head of sorted BIDs ladder (highest price) */
    int16_t  best_ask_idx;      /* Head of sorted ASKs ladder (lowest price) */
    uint32_t bid_count;
    uint32_t ask_count;
    clob_order_t bids[CLOB_MAX_ORDERS_PER_SIDE];
    clob_order_t asks[CLOB_MAX_ORDERS_PER_SIDE];
} clob_state_t;

typedef struct __attribute__((packed)) {
    uint32_t instruction_type;
    uint16_t clob_account_idx;
    uint8_t  seed[32];
} clob_init_args_t;

typedef struct __attribute__((packed)) {
    uint32_t instruction_type;
    uint16_t clob_account_idx;
    uint8_t  side;
    uint64_t price_hi;
    uint64_t price_lo;
    uint64_t qty;
} clob_place_order_args_t;

typedef struct __attribute__((packed)) {
    uint32_t instruction_type;
    uint16_t clob_account_idx;
    uint64_t order_id;
} clob_cancel_order_args_t;

#endif /* CLOB_ENGINE_H */
