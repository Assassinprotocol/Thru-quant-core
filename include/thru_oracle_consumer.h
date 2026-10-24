#ifndef THRU_ORACLE_CONSUMER_H
#define THRU_ORACLE_CONSUMER_H

#include <stdint.h>
#include <stdbool.h>
#include "thru_math.h"

#define THRU_ORACLE_V2_FEED_MAGIC (0x54464545U)

#define THRU_CONSUMER_FLAG_STALE             (1U << 0)
#define THRU_CONSUMER_FLAG_BIG_MOVE          (1U << 1)
#define THRU_CONSUMER_FLAG_LOW_CONFIDENCE    (1U << 2)
#define THRU_CONSUMER_FLAG_OUTLIER_REJECTED  (1U << 3)

typedef enum {
    THRU_CONSUMER_OK = 0,
    THRU_CONSUMER_ERR_INVALID_MAGIC = 1,
    THRU_CONSUMER_ERR_INVALID_VERSION = 2,
    THRU_CONSUMER_ERR_FEED_PAUSED = 3,
    THRU_CONSUMER_ERR_PRICE_ZERO = 4,
    THRU_CONSUMER_ERR_STALE = 5,
    THRU_CONSUMER_ERR_CONFIDENCE_TOO_LOW = 6,
    THRU_CONSUMER_ERR_OUT_OF_BOUNDS = 7,
    THRU_CONSUMER_ERR_CROSS_RATE_ZERO = 8
} thru_consumer_status_t;

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
} thru_feed_account_view_t;

_Static_assert(sizeof(thru_feed_account_view_t) == 88, "thru_feed_account_view_t footprint mismatch");

static inline thru_consumer_status_t thru_oracle_read_price(
    const thru_feed_account_view_t *feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    uint64_t *out_price
) {
    if (!feed || !out_price) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }
    if (feed->magic != THRU_ORACLE_V2_FEED_MAGIC) {
        return THRU_CONSUMER_ERR_INVALID_MAGIC;
    }
    if (feed->version != 2) {
        return THRU_CONSUMER_ERR_INVALID_VERSION;
    }
    if (feed->status != 1) {
        return THRU_CONSUMER_ERR_FEED_PAUSED;
    }
    if (feed->price == 0) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }
    if (current_slot > feed->publish_slot &&
        (current_slot - feed->publish_slot) > max_staleness_slots) {
        return THRU_CONSUMER_ERR_STALE;
    }
    if (max_confidence_bps > 0 && feed->confidence_bps > max_confidence_bps) {
        return THRU_CONSUMER_ERR_CONFIDENCE_TOO_LOW;
    }

    *out_price = feed->price;
    return THRU_CONSUMER_OK;
}

static inline bool thru_oracle_is_big_move(const thru_feed_account_view_t *feed) {
    return feed && ((feed->flags & THRU_CONSUMER_FLAG_BIG_MOVE) != 0);
}

static inline bool thru_oracle_had_outlier_rejected(const thru_feed_account_view_t *feed) {
    return feed && ((feed->flags & THRU_CONSUMER_FLAG_OUTLIER_REJECTED) != 0);
}

static inline bool thru_oracle_try_read(
    const thru_feed_account_view_t *feed,
    uint64_t *out_price
) {
    if (!feed || !out_price || feed->magic != THRU_ORACLE_V2_FEED_MAGIC || feed->status != 1 || feed->price == 0) {
        return false;
    }
    *out_price = feed->price;
    return true;
}

static inline thru_consumer_status_t thru_oracle_read_with_age(
    const thru_feed_account_view_t *feed,
    uint64_t current_slot,
    uint64_t *out_price,
    uint64_t *out_age_slots
) {
    if (!feed || !out_price || !out_age_slots) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }
    if (feed->magic != THRU_ORACLE_V2_FEED_MAGIC) {
        return THRU_CONSUMER_ERR_INVALID_MAGIC;
    }
    if (feed->status != 1 || feed->price == 0) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }
    *out_price = feed->price;
    *out_age_slots = (current_slot >= feed->publish_slot) ? (current_slot - feed->publish_slot) : 0;
    return THRU_CONSUMER_OK;
}

static inline thru_consumer_status_t thru_oracle_read_price_bounded(
    const thru_feed_account_view_t *feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    uint64_t min_price,
    uint64_t max_price,
    uint64_t *out_price
) {
    uint64_t price = 0;
    thru_consumer_status_t st = thru_oracle_read_price(
        feed, current_slot, max_staleness_slots, max_confidence_bps, &price
    );
    if (st != THRU_CONSUMER_OK) {
        return st;
    }
    if ((min_price > 0 && price < min_price) || (max_price > 0 && price > max_price)) {
        return THRU_CONSUMER_ERR_OUT_OF_BOUNDS;
    }
    *out_price = price;
    return THRU_CONSUMER_OK;
}

static inline bool thru_oracle_is_valid(
    const thru_feed_account_view_t *feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots
) {
    if (!feed || feed->magic != THRU_ORACLE_V2_FEED_MAGIC || feed->version != 2 ||
        feed->status != 1 || feed->price == 0) {
        return false;
    }
    if (current_slot > feed->publish_slot &&
        (current_slot - feed->publish_slot) > max_staleness_slots) {
        return false;
    }
    return true;
}

static inline thru_consumer_status_t thru_oracle_read_cross_rate(
    const thru_feed_account_view_t *base_feed,
    const thru_feed_account_view_t *quote_feed,
    uint64_t current_slot,
    uint64_t max_staleness_slots,
    uint64_t max_confidence_bps,
    q64_t *out_price_q64,
    uint64_t *out_conf_bps
) {
    if (!base_feed || !quote_feed || !out_price_q64) {
        return THRU_CONSUMER_ERR_PRICE_ZERO;
    }
    uint64_t base_price = 0;
    thru_consumer_status_t st_base = thru_oracle_read_price(
        base_feed, current_slot, max_staleness_slots, max_confidence_bps, &base_price
    );
    if (st_base != THRU_CONSUMER_OK) return st_base;

    uint64_t quote_price = 0;
    thru_consumer_status_t st_quote = thru_oracle_read_price(
        quote_feed, current_slot, max_staleness_slots, max_confidence_bps, &quote_price
    );
    if (st_quote != THRU_CONSUMER_OK) return st_quote;

    if (quote_price == 0) {
        return THRU_CONSUMER_ERR_CROSS_RATE_ZERO;
    }

    q64_t base_q64 = q64_from_int((int64_t)base_price);
    q64_t quote_q64 = q64_from_int((int64_t)quote_price);
    *out_price_q64 = q64_div(base_q64, quote_q64);

    if (out_conf_bps) {
        *out_conf_bps = base_feed->confidence_bps + quote_feed->confidence_bps;
    }
    return THRU_CONSUMER_OK;
}

#endif /* THRU_ORACLE_CONSUMER_H */
