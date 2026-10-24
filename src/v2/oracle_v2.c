#include <thru-sdk/c/tn_sdk.h>
#include <thru-sdk/c/tn_sdk_syscall.h>
#include "oracle_v2.h"

static inline uint64_t get_current_block_time_sec(void) {
    const tsdk_block_ctx_t *ctx = tsdk_get_current_block_ctx();
    return ctx ? (ctx->block_time / 1000000000ULL) : 0ULL;
}

static inline uint64_t get_current_slot(void) {
    const tsdk_block_ctx_t *ctx = tsdk_get_current_block_ctx();
    return ctx ? ctx->slot : 0ULL;
}

static bool is_admin_authorized(const registry_account_data_t *reg, const uint8_t *fee_payer) {
    for (uint32_t i = 0; i < reg->admin_n && i < 5; i++) {
        if (memcmp(reg->admin_keys[i], fee_payer, 32) == 0) {
            return true;
        }
    }
    return false;
}

static int find_publisher_index(const registry_account_data_t *reg, const uint8_t *pubkey) {
    for (uint32_t i = 0; i < reg->publisher_count && i < ORACLE_V2_MAX_PUBLISHERS; i++) {
        if (memcmp(reg->publishers[i].pubkey, pubkey, 32) == 0) {
            return (int)i;
        }
    }
    return -1;
}

static feed_config_t *find_feed_config(registry_account_data_t *reg, uint32_t symbol_id) {
    for (uint32_t i = 0; i < reg->feed_count && i < ORACLE_V2_MAX_FEEDS; i++) {
        if (reg->feeds[i].symbol_id == symbol_id) {
            return &reg->feeds[i];
        }
    }
    return NULL;
}

static void ensure_account_writable(ushort acc_idx, ulong required_sz) {
    if (!tsdk_is_account_idx_valid(acc_idx)) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (!tsdk_account_exists(acc_idx)) {
        uchar seed[32] = {0};
        ulong rc = tsys_account_create_ephemeral((ulong)acc_idx, seed);
        if (rc != 0UL) {
            tsdk_revert(ORACLE_V2_ERR_CREATE_FAILED);
        }
    }
    tsys_set_account_data_writable(acc_idx);
    const tsdk_account_meta_t *meta = tsdk_get_account_meta(acc_idx);
    if (!meta || meta->data_sz < required_sz) {
        ulong rc = tsys_account_resize(acc_idx, required_sz);
        if (rc != 0UL) {
            tsdk_revert(ORACLE_V2_ERR_RESIZE_FAILED);
        }
    }
}

static void handle_init_registry(const void *data, ulong sz) {
    if (sz < sizeof(init_registry_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const init_registry_args_t *args = (const init_registry_args_t *)data;
    if (args->admin_m == 0 || args->admin_m > args->admin_n || args->admin_n > 5 || args->min_publishers < 3) {
        tsdk_revert(ORACLE_V2_ERR_INSUFFICIENT_SIGNERS);
    }

    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic == ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_ALREADY_INIT);
    }

    memset(reg, 0, sizeof(registry_account_data_t));
    reg->magic = ORACLE_V2_REGISTRY_MAGIC;
    reg->version = 2;
    reg->admin_m = args->admin_m;
    reg->admin_n = args->admin_n;
    reg->min_publishers = args->min_publishers;
    memcpy(reg->admin_keys, args->admin_keys, sizeof(reg->admin_keys));
    const uint32_t core_symbols[6] = {1, 2, 3, 4, 5, 6};
    reg->feed_count = 6;
    for (uint32_t i = 0; i < 6; i++) {
        reg->feeds[i].symbol_id = core_symbols[i];
        reg->feeds[i].status = 1;
        reg->feeds[i].outlier_bps = 100;
        reg->feeds[i].max_staleness_slots = 120;
        reg->feeds[i].big_move_bps = 300;
    }

    tsdk_return(TSDK_SUCCESS);
}

static void handle_set_publisher(const void *data, ulong sz) {
    if (sz < sizeof(set_publisher_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const set_publisher_args_t *args = (const set_publisher_args_t *)data;
    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (!is_admin_authorized(reg, tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc)) {
        tsdk_revert(ORACLE_V2_ERR_UNAUTHORIZED);
    }

    int idx = find_publisher_index(reg, args->publisher_pubkey);
    if (idx >= 0) {
        reg->publishers[idx].status = args->status;
    } else {
        if (reg->publisher_count >= ORACLE_V2_MAX_PUBLISHERS) {
            tsdk_revert(ORACLE_V2_ERR_INVALID_INDEX);
        }
        uint32_t new_idx = reg->publisher_count++;
        memcpy(reg->publishers[new_idx].pubkey, args->publisher_pubkey, 32);
        reg->publishers[new_idx].status = args->status;
        reg->publishers[new_idx].weight = 1;
        reg->publishers[new_idx].last_submission_slot = 0;
    }

    tsdk_return(TSDK_SUCCESS);
}

static void handle_queue_config(const void *data, ulong sz) {
    if (sz < sizeof(queue_config_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const queue_config_args_t *args = (const queue_config_args_t *)data;
    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (!is_admin_authorized(reg, tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc)) {
        tsdk_revert(ORACLE_V2_ERR_UNAUTHORIZED);
    }
    if (reg->timelock_count >= ORACLE_V2_MAX_TIMELOCK) {
        tsdk_revert(ORACLE_V2_ERR_TIMELOCK_QUEUE_FULL);
    }

    uint32_t slot = reg->timelock_count++;
    reg->timelock_queue[slot].action_id = args->action_id;
    reg->timelock_queue[slot].target_id = args->target_id;
    reg->timelock_queue[slot].param_val = args->param_val;
    reg->timelock_queue[slot].unlock_timestamp = get_current_block_time_sec() + ORACLE_V2_TIMELOCK_DELAY;

    tsdk_return(TSDK_SUCCESS);
}

static void handle_apply_config(const void *data, ulong sz) {
    if (sz < sizeof(apply_config_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const apply_config_args_t *args = (const apply_config_args_t *)data;
    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (args->queue_index >= reg->timelock_count) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_INDEX);
    }

    timelock_entry_t *entry = &reg->timelock_queue[args->queue_index];
    if (get_current_block_time_sec() < entry->unlock_timestamp) {
        tsdk_revert(ORACLE_V2_ERR_TIMELOCK_NOT_EXPIRED);
    }

    if (entry->action_id == 1 && entry->param_val >= 3) {
        reg->min_publishers = (uint32_t)entry->param_val;
    } else {
        feed_config_t *cfg = find_feed_config(reg, entry->target_id);
        if (cfg) {
            if (entry->action_id == 2) cfg->outlier_bps = (uint32_t)entry->param_val;
            else if (entry->action_id == 3) cfg->big_move_bps = (uint32_t)entry->param_val;
            else if (entry->action_id == 4) cfg->max_staleness_slots = (uint32_t)entry->param_val;
        }
    }

    for (uint32_t i = args->queue_index; i + 1 < reg->timelock_count; i++) {
        reg->timelock_queue[i] = reg->timelock_queue[i + 1];
    }
    reg->timelock_count--;

    tsdk_return(TSDK_SUCCESS);
}

static void handle_emergency_symbol(const void *data, ulong sz, uint32_t target_status) {
    if (sz < sizeof(emergency_symbol_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const emergency_symbol_args_t *args = (const emergency_symbol_args_t *)data;
    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (!is_admin_authorized(reg, tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc)) {
        tsdk_revert(ORACLE_V2_ERR_UNAUTHORIZED);
    }

    feed_config_t *cfg = find_feed_config(reg, args->symbol_id);
    if (cfg) {
        cfg->status = target_status;
    }

    ensure_account_writable(args->feed_acc_idx, sizeof(feed_account_data_t));
    feed_account_data_t *feed = (feed_account_data_t *)tsdk_get_account_data_ptr(args->feed_acc_idx);
    if (feed->magic == ORACLE_V2_FEED_MAGIC) {
        feed->status = target_status;
    }

    tsdk_return(TSDK_SUCCESS);
}

static void handle_propose_admin(const void *data, ulong sz) {
    if (sz < sizeof(propose_admin_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const propose_admin_args_t *args = (const propose_admin_args_t *)data;
    if (args->new_m == 0 || args->new_m > args->new_n || args->new_n > 5) {
        tsdk_revert(ORACLE_V2_ERR_INSUFFICIENT_SIGNERS);
    }

    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    if (!is_admin_authorized(reg, tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc)) {
        tsdk_revert(ORACLE_V2_ERR_UNAUTHORIZED);
    }

    reg->pending_admin_m = args->new_m;
    reg->pending_admin_n = args->new_n;
    memcpy(reg->pending_admin_keys, args->new_admin_keys, sizeof(reg->pending_admin_keys));
    reg->admin_transfer_expiry = get_current_block_time_sec() + ORACLE_V2_ADMIN_EXPIRY;

    tsdk_return(TSDK_SUCCESS);
}

static void handle_accept_admin(const void *data, ulong sz) {
    if (sz < sizeof(accept_admin_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const accept_admin_args_t *args = (const accept_admin_args_t *)data;
    ensure_account_writable(args->registry_acc_idx, sizeof(registry_account_data_t));
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }

    const uint8_t *fee_payer = tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc;
    bool is_pending_admin = false;
    for (uint32_t i = 0; i < reg->pending_admin_n && i < 5; i++) {
        if (memcmp(reg->pending_admin_keys[i], fee_payer, 32) == 0) {
            is_pending_admin = true;
            break;
        }
    }
    if (!is_pending_admin) {
        tsdk_revert(ORACLE_V2_ERR_UNAUTHORIZED);
    }
    if (get_current_block_time_sec() > reg->admin_transfer_expiry) {
        tsdk_revert(ORACLE_V2_ERR_TIMELOCK_NOT_EXPIRED);
    }

    reg->admin_m = reg->pending_admin_m;
    reg->admin_n = reg->pending_admin_n;
    memcpy(reg->admin_keys, reg->pending_admin_keys, sizeof(reg->admin_keys));
    memset(reg->pending_admin_keys, 0, sizeof(reg->pending_admin_keys));
    reg->pending_admin_m = 0;
    reg->pending_admin_n = 0;
    reg->admin_transfer_expiry = 0;

    tsdk_return(TSDK_SUCCESS);
}

static void handle_submit_prices(const void *data, ulong sz) {
    if (sz < sizeof(submit_prices_hdr_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const submit_prices_hdr_t *hdr = (const submit_prices_hdr_t *)data;
    if (hdr->quote_count > ORACLE_V2_MAX_FEEDS) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_INDEX);
    }
    ulong expected_sz = sizeof(submit_prices_hdr_t) + (hdr->quote_count * sizeof(raw_quote_t));
    if (sz < expected_sz) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }

    const tsdk_account_meta_t *reg_meta = tsdk_get_account_meta(hdr->registry_acc_idx);
    if (!reg_meta || reg_meta->data_sz < sizeof(registry_account_data_t)) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    const registry_account_data_t *reg = (const registry_account_data_t *)tsdk_get_account_data_ptr(hdr->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }

    const uint8_t *fee_payer = tsdk_get_txn()->hdr.v1.fee_payer_pubkey.uc;
    int pub_idx = find_publisher_index(reg, fee_payer);
    if (pub_idx < 0) {
        tsdk_revert(ORACLE_V2_ERR_PUBLISHER_NOT_FOUND);
    }
    if (reg->publishers[pub_idx].status != 1) {
        tsdk_revert(ORACLE_V2_ERR_PUBLISHER_SUSPENDED);
    }

    ensure_account_writable(hdr->submission_acc_idx, sizeof(submission_account_data_t));
    submission_account_data_t *sub = (submission_account_data_t *)tsdk_get_account_data_ptr(hdr->submission_acc_idx);

    if (sub->magic == ORACLE_V2_SUBMISSION_MAGIC) {
        if (memcmp(sub->publisher_pubkey, fee_payer, 32) != 0) {
            tsdk_revert(ORACLE_V2_ERR_ACCOUNT_MISMATCH);
        }
        if (hdr->sequence_number <= sub->sequence_number) {
            tsdk_revert(ORACLE_V2_ERR_INVALID_SEQUENCE);
        }
    } else {
        memset(sub, 0, sizeof(submission_account_data_t));
        sub->magic = ORACLE_V2_SUBMISSION_MAGIC;
        sub->version = 2;
        memcpy(sub->publisher_pubkey, fee_payer, 32);
    }

    uint64_t cur_time = get_current_block_time_sec();
    const raw_quote_t *quotes = (const raw_quote_t *)((const uint8_t *)data + sizeof(submit_prices_hdr_t));

    for (uint32_t i = 0; i < hdr->quote_count; i++) {
        if (quotes[i].source_ts + 30 < cur_time || quotes[i].source_ts > cur_time + 5) {
            tsdk_revert(ORACLE_V2_ERR_TIMESTAMP_SKEW);
        }
        sub->quotes[i] = quotes[i];
    }

    sub->sequence_number = hdr->sequence_number;
    sub->publish_slot = get_current_slot();
    sub->quote_count = hdr->quote_count;

    tsdk_return(TSDK_SUCCESS);
}

static void handle_aggregate(const void *data, ulong sz) {
    if (sz < sizeof(aggregate_args_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }
    const aggregate_args_t *args = (const aggregate_args_t *)data;

    const tsdk_account_meta_t *reg_meta = tsdk_get_account_meta(args->registry_acc_idx);
    if (!reg_meta || reg_meta->data_sz < sizeof(registry_account_data_t)) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }
    registry_account_data_t *reg = (registry_account_data_t *)tsdk_get_account_data_ptr(args->registry_acc_idx);
    if (reg->magic != ORACLE_V2_REGISTRY_MAGIC) {
        tsdk_revert(ORACLE_V2_ERR_DATA_ACCESS);
    }

    feed_config_t *feed_cfg = find_feed_config(reg, args->symbol_id);
    if (!feed_cfg || feed_cfg->status == 2) {
        tsdk_revert(ORACLE_V2_ERR_FEED_PAUSED);
    }

    ensure_account_writable(args->feed_acc_idx, sizeof(feed_account_data_t));
    feed_account_data_t *feed = (feed_account_data_t *)tsdk_get_account_data_ptr(args->feed_acc_idx);
    if (feed->magic != ORACLE_V2_FEED_MAGIC) {
        memset(feed, 0, sizeof(feed_account_data_t));
        feed->magic = ORACLE_V2_FEED_MAGIC;
        feed->version = 2;
        feed->symbol_id = args->symbol_id;
        feed->status = 1;
    }

    if (feed->status == 2) {
        tsdk_revert(ORACLE_V2_ERR_FEED_PAUSED);
    }

    uint64_t cur_slot = get_current_slot();
    uint64_t cur_time = get_current_block_time_sec();
    quote_entry_t candidates[7];
    uint32_t candidate_count = 0;
    uint32_t contributor_mask = 0;

    for (uint32_t i = 0; i < reg->publisher_count && i < ORACLE_V2_MAX_PUBLISHERS; i++) {
        if (reg->publishers[i].status != 1) continue;
        ushort sub_acc_idx = args->submission_acc_indices[i];
        if (!tsdk_is_account_idx_valid(sub_acc_idx) || !tsdk_account_exists(sub_acc_idx)) continue;

        const submission_account_data_t *sub = (const submission_account_data_t *)tsdk_get_account_data_ptr(sub_acc_idx);
        if (sub->magic != ORACLE_V2_SUBMISSION_MAGIC) continue;
        if (memcmp(sub->publisher_pubkey, reg->publishers[i].pubkey, 32) != 0) continue;
        if (sub->publish_slot > cur_slot || (cur_slot - sub->publish_slot) > feed_cfg->max_staleness_slots) continue;

        for (uint32_t q = 0; q < sub->quote_count; q++) {
            if (sub->quotes[q].symbol_id == args->symbol_id && sub->quotes[q].price > 0) {
                if (sub->quotes[q].source_ts + 30 >= cur_time && sub->quotes[q].source_ts <= cur_time + 5) {
                    candidates[candidate_count].price = sub->quotes[q].price;
                    candidates[candidate_count].source_ts = sub->quotes[q].source_ts;
                    contributor_mask |= (1U << i);
                    candidate_count++;
                }
                break;
            }
        }
    }

    if (candidate_count < reg->min_publishers) {
        feed->flags |= FEED_FLAG_STALE;
        tsdk_return(TSDK_SUCCESS);
    }

    aggregation_output_t out = aggregate_symbol_quotes(
        candidates,
        candidate_count,
        reg->min_publishers,
        feed_cfg->outlier_bps,
        feed_cfg->big_move_bps,
        feed->price
    );

    if (!out.success) {
        feed->flags |= out.flags;
        tsdk_return(TSDK_SUCCESS);
    }

    uint64_t ts_arr[7];
    for (uint32_t i = 0; i < candidate_count; i++) ts_arr[i] = candidates[i].source_ts;
    for (uint32_t i = 0; i < candidate_count; i++) {
        for (uint32_t j = i + 1; j < candidate_count; j++) {
            if (ts_arr[i] > ts_arr[j]) {
                uint64_t t = ts_arr[i]; ts_arr[i] = ts_arr[j]; ts_arr[j] = t;
            }
        }
    }
    uint64_t median_ts = ts_arr[candidate_count / 2];

    feed->prev_price = feed->price;
    feed->price = out.price;
    feed->confidence_bps = out.confidence_bps;
    feed->prev_publish_slot = feed->publish_slot;
    feed->publish_slot = cur_slot;
    feed->median_source_ts = median_ts;
    feed->contributor_count = out.contributor_count;
    feed->flags = out.flags;
    feed->contributor_mask = (uint8_t)(contributor_mask & 0xFF);

    event_aggregate_updated_t ev = {
        .event_type = ORACLE_V2_EVENT_AGGREGATE,
        .symbol_id = (uint8_t)args->symbol_id,
        .flags = (uint16_t)out.flags,
        .contributor_mask = contributor_mask,
        .price = out.price,
        .confidence_bps = out.confidence_bps,
        .publish_slot = cur_slot,
        .median_source_ts = median_ts
    };
    tsys_emit_event(&ev, sizeof(ev));

    tsdk_return(TSDK_SUCCESS);
}

TSDK_ENTRYPOINT_FN void start(void const *instruction_data, ulong instruction_data_sz) {
    if (instruction_data_sz < sizeof(uint32_t)) {
        tsdk_revert(ORACLE_V2_ERR_INVALID_SIZE);
    }

    uint32_t opcode = *(const uint32_t *)instruction_data;
    switch (opcode) {
        case ORACLE_V2_OP_INITIALIZE_REGISTRY:
            handle_init_registry(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_SET_PUBLISHER:
            handle_set_publisher(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_QUEUE_CONFIG:
            handle_queue_config(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_APPLY_CONFIG:
            handle_apply_config(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_EMERGENCY_PAUSE:
            handle_emergency_symbol(instruction_data, instruction_data_sz, 2);
            break;
        case ORACLE_V2_OP_EMERGENCY_RESUME:
            handle_emergency_symbol(instruction_data, instruction_data_sz, 1);
            break;
        case ORACLE_V2_OP_PROPOSE_ADMIN:
            handle_propose_admin(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_ACCEPT_ADMIN:
            handle_accept_admin(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_SUBMIT_PRICES:
            handle_submit_prices(instruction_data, instruction_data_sz);
            break;
        case ORACLE_V2_OP_AGGREGATE:
            handle_aggregate(instruction_data, instruction_data_sz);
            break;
        default:
            tsdk_revert(ORACLE_V2_ERR_INVALID_OPCODE);
    }

    tsdk_return(TSDK_SUCCESS);
}
