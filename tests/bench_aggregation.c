#define _POSIX_C_SOURCE 199309L
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
#include "aggregation_math.h"

#define BENCH_ITERS 1000000L

static double get_elapsed_ns(struct timespec s, struct timespec e) {
    return (double)(e.tv_sec - s.tv_sec) * 1e9 + (double)(e.tv_nsec - s.tv_nsec);
}

int main(void) {
    quote_entry_t quotes[7] = {
        {8400050000000ULL, 1700000000},
        {8401000000000ULL, 1700000001},
        {8399500000000ULL, 1700000000},
        {8400200000000ULL, 1700000001},
        {8600000000000ULL, 1700000000},
        {8400800000000ULL, 1700000000},
        {8400300000000ULL, 1700000001}
    };

    uint32_t pub_counts[3] = {3, 5, 7};
    printf("=== Oracle v2 Aggregation Benchmark ===\n");

    for (int p = 0; p < 3; p++) {
        uint32_t n = pub_counts[p];
        struct timespec s, e;
        volatile uint64_t dummy = 0;

        clock_gettime(CLOCK_MONOTONIC, &s);
        for (long i = 0; i < BENCH_ITERS; i++) {
            aggregation_output_t r = aggregate_symbol_quotes(quotes, n, 3, 100, 300, 8390000000000ULL);
            dummy += r.price;
        }
        clock_gettime(CLOCK_MONOTONIC, &e);

        double ns_per_op = get_elapsed_ns(s, e) / (double)BENCH_ITERS;
        double ops_sec = 1000.0 / ns_per_op;
        double core6_ns = ns_per_op * 6.0;
        double sym16_ns = ns_per_op * 16.0;

        printf("[N=%u Publishers]\n", n);
        printf("  1 Symbol  : %6.2f ns/op (%6.2f M ops/sec)\n", ns_per_op, ops_sec);
        printf("  Core-6    : %6.2f ns total batch (~%5.1f K batches/sec)\n", core6_ns, 1e6 / core6_ns);
        printf("  16 Symbols: %6.2f ns total batch (~%5.1f K batches/sec)\n", sym16_ns, 1e6 / sym16_ns);
    }

    return 0;
}
