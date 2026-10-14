#ifndef MARKET_ORACLE_H
#define MARKET_ORACLE_H

#include <stdint.h>
#include "thru_math.h"

/* Instruction types */
#define ORACLE_INSTR_INITIALIZE     (0U)
#define ORACLE_INSTR_UPDATE_PRICES  (1U)

/* Error codes */
#define ORACLE_ERR_INVALID_INSTR_SIZE   (0x2001UL)
#define ORACLE_ERR_INVALID_INSTR_TYPE   (0x2002UL)
#define ORACLE_ERR_UNAUTHORIZED         (0x2003UL)
#define ORACLE_ERR_DATA_ACCESS_FAILED   (0x2004UL)
#define ORACLE_ERR_ACCOUNT_INIT_FAILED  (0x2005UL)
#define ORACLE_ERR_INVALID_COUNT        (0x2006UL)
#define ORACLE_ERR_CIRCUIT_BREAKER      (0x2007UL)

#define MAX_ORACLE_SYMBOLS (32)
#define MAX_ALLOWED_DEVIATION_BPS (500) /* Max 5% delta per single slot update */

/* Single market asset quote */
typedef struct __attribute__((packed)) {
    uint32_t symbol_id;        /* 1: BTC, 2: ETH, 3: SOL, 4: APT, etc. */
    uint64_t price_q64_hi;     /* High 64 bits of Q64.64 price */
    uint64_t price_q64_lo;     /* Low 64 bits of Q64.64 price */
    uint32_t volatility_bps;   /* Volatility in basis points (100 = 1%) */
    uint32_t timestamp;        /* Unix timestamp of price capture */
} oracle_entry_t;

/* State stored inside the Oracle program account */
typedef struct __attribute__((packed)) {
    uint32_t version;
    uint8_t  authority_pubkey[32];   /* Cryptographic authority allowed to update prices */
    uint8_t  circuit_breaker_active; /* 1 if circuit breaker was triggered */
    uint8_t  _reserved[3];
    uint32_t regime_id;             /* 0: Neutral, 1: Trending Up, 2: Trending Down, 3: High Vol */
    uint32_t last_update_ts;
    uint32_t entry_count;
    oracle_entry_t entries[MAX_ORACLE_SYMBOLS];
} oracle_account_data_t;

/* Arguments for initializing */
typedef struct __attribute__((packed)) {
    uint32_t instruction_type;
    uint16_t oracle_account_idx;
    uint8_t  seed[32];
} oracle_init_args_t;

/* Header for updating prices (followed by oracle_entry_t entries[entry_count]) */
typedef struct __attribute__((packed)) {
    uint32_t instruction_type;
    uint16_t oracle_account_idx;
    uint32_t regime_id;
    uint32_t timestamp;
    uint32_t entry_count;
} oracle_update_hdr_t;

#endif /* MARKET_ORACLE_H */
