#ifndef THRU_ORACLE_V2_H
#define THRU_ORACLE_V2_H

#include <stdint.h>
#include <stdbool.h>
#include "aggregation_math.h"

#define ORACLE_V2_REGISTRY_MAGIC   (0x54524547U) /* "TREG" */
#define ORACLE_V2_SUBMISSION_MAGIC (0x54535542U) /* "TSUB" */
#define ORACLE_V2_FEED_MAGIC       (0x54464545U) /* "TFEE" */
#define ORACLE_V2_EVENT_AGGREGATE  (0x01U)

#ifndef ORACLE_V2_MAX_PUBLISHERS
#define ORACLE_V2_MAX_PUBLISHERS   (7U)
#endif
#define ORACLE_V2_MAX_FEEDS        (32U)
#define ORACLE_V2_MAX_ADMIN_KEYS   (5U)
#define ORACLE_V2_MAX_TIMELOCK     (8U)
#define ORACLE_V2_TIMELOCK_DELAY   (86400ULL)
#define ORACLE_V2_ADMIN_EXPIRY     (604800ULL)

#define ORACLE_V2_OP_INITIALIZE_REGISTRY (0x0001U)
#define ORACLE_V2_OP_SUBMIT_PRICES       (0x0002U)
#define ORACLE_V2_OP_AGGREGATE           (0x0003U)
#define ORACLE_V2_OP_QUEUE_CONFIG        (0x0004U)
#define ORACLE_V2_OP_APPLY_CONFIG        (0x0005U)
#define ORACLE_V2_OP_EMERGENCY_PAUSE     (0x0006U)
#define ORACLE_V2_OP_EMERGENCY_RESUME    (0x0007U)
#define ORACLE_V2_OP_SET_PUBLISHER       (0x0008U)
#define ORACLE_V2_OP_PROPOSE_ADMIN       (0x0009U)
#define ORACLE_V2_OP_ACCEPT_ADMIN        (0x000AU)

#define ORACLE_V2_ERR_INVALID_SIZE         (0x2101UL)
#define ORACLE_V2_ERR_INVALID_OPCODE       (0x2102UL)
#define ORACLE_V2_ERR_UNAUTHORIZED         (0x2103UL)
#define ORACLE_V2_ERR_DATA_ACCESS          (0x2104UL)
#define ORACLE_V2_ERR_ALREADY_INIT         (0x2105UL)
#define ORACLE_V2_ERR_INSUFFICIENT_SIGNERS (0x2106UL)
#define ORACLE_V2_ERR_TIMELOCK_NOT_EXPIRED (0x2107UL)
#define ORACLE_V2_ERR_TIMELOCK_QUEUE_FULL  (0x2108UL)
#define ORACLE_V2_ERR_INVALID_INDEX        (0x2109UL)
#define ORACLE_V2_ERR_INVALID_SEQUENCE     (0x210AUL)
#define ORACLE_V2_ERR_FEED_PAUSED          (0x210BUL)
#define ORACLE_V2_ERR_INSUFFICIENT_QUORUM  (0x210CUL)
#define ORACLE_V2_ERR_PUBLISHER_NOT_FOUND  (0x210DUL)
#define ORACLE_V2_ERR_PUBLISHER_SUSPENDED  (0x210EUL)
#define ORACLE_V2_ERR_ACCOUNT_MISMATCH     (0x210FUL)
#define ORACLE_V2_ERR_TIMESTAMP_SKEW       (0x2110UL)
#define ORACLE_V2_ERR_RESIZE_FAILED        (0x2111UL)
#define ORACLE_V2_ERR_CREATE_FAILED        (0x2112UL)

typedef struct __attribute__((packed)) {
    uint8_t  pubkey[32];
    uint32_t status;
    uint32_t weight;
    uint64_t last_submission_slot;
} publisher_desc_t;

typedef struct __attribute__((packed)) {
    uint32_t symbol_id;
    uint32_t status;
    uint32_t outlier_bps;
    uint32_t max_staleness_slots;
    uint32_t big_move_bps;
    uint32_t reserved;
} feed_config_t;

typedef struct __attribute__((packed)) {
    uint32_t action_id;
    uint32_t target_id;
    uint64_t param_val;
    uint64_t unlock_timestamp;
} timelock_entry_t;

typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint32_t version;
    uint32_t admin_m;
    uint32_t admin_n;
    uint8_t  admin_keys[5][32];
    uint8_t  pending_admin_keys[5][32];
    uint32_t pending_admin_m;
    uint32_t pending_admin_n;
    uint64_t admin_transfer_expiry;

    uint32_t min_publishers;
    uint32_t publisher_count;
    publisher_desc_t publishers[7];

    uint32_t feed_count;
    feed_config_t feeds[32];

    uint32_t timelock_count;
    timelock_entry_t timelock_queue[8];
    uint8_t  _reserved[112];
} registry_account_data_t;

typedef struct __attribute__((packed)) {
    uint32_t symbol_id;
    uint32_t reserved;
    uint64_t price;
    uint64_t source_ts;
} raw_quote_t;

typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint32_t version;
    uint8_t  publisher_pubkey[32];
    uint64_t sequence_number;
    uint64_t publish_slot;
    uint32_t quote_count;
    uint32_t flags;
    raw_quote_t quotes[32];
} submission_account_data_t;

typedef struct __attribute__((packed)) {
    uint32_t magic;
    uint32_t version;
    uint32_t symbol_id;
    uint32_t status;
    uint64_t price;
    uint64_t prev_price;
    uint64_t confidence_bps;
    uint64_t publish_slot;
    uint64_t prev_publish_slot;
    uint64_t median_source_ts;
    uint32_t contributor_count;
    uint32_t flags;
    uint8_t  contributor_mask;
    uint8_t  _padding[7];
    uint64_t _reserved;
} feed_account_data_t;

typedef struct __attribute__((packed)) {
    uint8_t  event_type;
    uint8_t  symbol_id;
    uint16_t flags;
    uint32_t contributor_mask;
    uint64_t price;
    uint64_t confidence_bps;
    uint64_t publish_slot;
    uint64_t median_source_ts;
} event_aggregate_updated_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint32_t admin_m;
    uint32_t admin_n;
    uint32_t min_publishers;
    uint8_t  admin_keys[5][32];
} init_registry_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint16_t submission_acc_idx;
    uint64_t sequence_number;
    uint32_t quote_count;
} submit_prices_hdr_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint16_t feed_acc_idx;
    uint32_t symbol_id;
    uint16_t submission_acc_indices[7];
} aggregate_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint32_t action_id;
    uint32_t target_id;
    uint64_t param_val;
} queue_config_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint32_t queue_index;
} apply_config_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint16_t feed_acc_idx;
    uint32_t symbol_id;
} emergency_symbol_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint8_t  publisher_pubkey[32];
    uint32_t status;
} set_publisher_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
    uint32_t new_m;
    uint32_t new_n;
    uint8_t  new_admin_keys[5][32];
} propose_admin_args_t;

typedef struct __attribute__((packed)) {
    uint32_t opcode;
    uint16_t registry_acc_idx;
} accept_admin_args_t;

_Static_assert(sizeof(registry_account_data_t) == 1776, "registry_account_data_t footprint mismatch");
_Static_assert(sizeof(submission_account_data_t) == 832, "submission_account_data_t footprint mismatch");
_Static_assert(sizeof(feed_account_data_t) == 88, "feed_account_data_t footprint mismatch");
_Static_assert(sizeof(event_aggregate_updated_t) == 40, "event_aggregate_updated_t footprint mismatch");

#endif /* THRU_ORACLE_V2_H */
