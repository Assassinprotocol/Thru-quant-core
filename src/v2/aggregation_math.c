#include "aggregation_math.h"

__extension__ typedef unsigned __int128 u128_t;

static inline void sort_u64(uint64_t *arr, uint32_t n) {
    for (uint32_t i = 1; i < n; i++) {
        uint64_t key = arr[i];
        int32_t j = (int32_t)i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}

static inline uint64_t calc_median(const uint64_t *sorted, uint32_t n) {
    if (n == 0) return 0;
    if (n & 1) {
        return sorted[n / 2];
    }
    return (sorted[(n / 2) - 1] + sorted[n / 2]) / 2;
}

aggregation_output_t aggregate_symbol_quotes(
    const quote_entry_t *quotes,
    uint32_t count,
    uint32_t min_quorum,
    uint32_t outlier_bps,
    uint32_t big_move_bps,
    uint64_t prev_price
) {
    aggregation_output_t res;
    res.price = 0;
    res.confidence_bps = 0;
    res.flags = 0;
    res.contributor_count = 0;
    res.success = false;

    if (count < min_quorum || count > ORACLE_V2_MAX_PUBLISHERS) {
        res.flags |= FEED_FLAG_STALE;
        return res;
    }

    uint64_t p1_prices[ORACLE_V2_MAX_PUBLISHERS];
    for (uint32_t i = 0; i < count; i++) {
        p1_prices[i] = quotes[i].price;
    }

    sort_u64(p1_prices, count);
    uint64_t m1 = calc_median(p1_prices, count);
    if (m1 == 0) {
        res.flags |= FEED_FLAG_STALE;
        return res;
    }

    uint64_t filtered[ORACLE_V2_MAX_PUBLISHERS];
    uint32_t filtered_count = 0;
    uint32_t outlier_dropped = 0;

    for (uint32_t i = 0; i < count; i++) {
        uint64_t p = quotes[i].price;
        uint64_t diff = (p > m1) ? (p - m1) : (m1 - p);
        uint64_t dev_bps = (uint64_t)(((u128_t)diff * 10000ULL) / m1);
        if (dev_bps <= (uint64_t)outlier_bps) {
            filtered[filtered_count++] = p;
        } else {
            outlier_dropped++;
        }
    }

    if (filtered_count < min_quorum) {
        res.flags |= FEED_FLAG_LOW_CONFIDENCE;
        return res;
    }

    sort_u64(filtered, filtered_count);
    uint64_t m2 = calc_median(filtered, filtered_count);

    uint64_t residuals[ORACLE_V2_MAX_PUBLISHERS];
    for (uint32_t i = 0; i < filtered_count; i++) {
        uint64_t p = filtered[i];
        residuals[i] = (p > m2) ? (p - m2) : (m2 - p);
    }
    sort_u64(residuals, filtered_count);
    uint64_t mad = calc_median(residuals, filtered_count);
    uint64_t conf_bps = (m2 > 0) ? (uint64_t)(((u128_t)mad * 10000ULL) / m2) : 0;

    uint32_t flags = 0;
    if (prev_price > 0) {
        uint64_t shift = (m2 > prev_price) ? (m2 - prev_price) : (prev_price - m2);
        uint64_t shift_bps = (uint64_t)(((u128_t)shift * 10000ULL) / prev_price);
        if (shift_bps >= (uint64_t)big_move_bps) {
            flags |= FEED_FLAG_BIG_MOVE;
        }
    }
    if (conf_bps >= 50) {
        flags |= FEED_FLAG_LOW_CONFIDENCE;
    }
    if (outlier_dropped > 0) {
        flags |= FEED_FLAG_OUTLIER_REJECTED;
    }

    res.price = m2;
    res.confidence_bps = conf_bps;
    res.contributor_count = filtered_count;
    res.flags = flags;
    res.success = true;
    return res;
}
