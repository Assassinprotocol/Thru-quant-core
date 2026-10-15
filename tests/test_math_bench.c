#define _POSIX_C_SOURCE 199309L
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <time.h>
#include "thru_math.h"

#define BENCH_ITERATIONS (10000000L)

static double get_elapsed_ns(struct timespec start, struct timespec end) {
    return (double)(end.tv_sec - start.tv_sec) * 1e9 + (double)(end.tv_nsec - start.tv_nsec);
}

int main(void) {
    struct timespec start, end;
    volatile q64_t sink = 0;

    /* 1. Benchmark: q64_from_int */
    clock_gettime(CLOCK_MONOTONIC, &start);
    q64_t acc1 = 0;
    for (long i = 0; i < BENCH_ITERATIONS; i++) {
        acc1 += q64_from_int(i & 0x7FFFFFFF);
    }
    clock_gettime(CLOCK_MONOTONIC, &end);
    sink = acc1;
    double ns_from_int = get_elapsed_ns(start, end) / (double)BENCH_ITERATIONS;
    printf("[BENCHMARK] q64_from_int : %6.2f ns/op (%8.2f M ops/sec)\n", ns_from_int, 1000.0 / ns_from_int);

    /* 2. Benchmark: q64_mul */
    q64_t a = q64_from_int(1234);
    q64_t b = q64_div(q64_from_int(1), q64_from_int(3)); // 1/3
    clock_gettime(CLOCK_MONOTONIC, &start);
    q64_t acc2 = 0;
    for (long i = 0; i < BENCH_ITERATIONS; i++) {
        acc2 += q64_mul(a, b);
    }
    clock_gettime(CLOCK_MONOTONIC, &end);
    sink = acc2;
    double ns_mul = get_elapsed_ns(start, end) / (double)BENCH_ITERATIONS;
    printf("[BENCHMARK] q64_mul      : %6.2f ns/op (%8.2f M ops/sec)\n", ns_mul, 1000.0 / ns_mul);

    /* 3. Benchmark: q64_div */
    q64_t c = q64_from_int(83450);
    q64_t d = q64_from_int(2500);
    clock_gettime(CLOCK_MONOTONIC, &start);
    q64_t acc3 = 0;
    for (long i = 0; i < BENCH_ITERATIONS; i++) {
        acc3 += q64_div(c, d);
    }
    clock_gettime(CLOCK_MONOTONIC, &end);
    sink = acc3;
    double ns_div = get_elapsed_ns(start, end) / (double)BENCH_ITERATIONS;
    printf("[BENCHMARK] q64_div      : %6.2f ns/op (%8.2f M ops/sec)\n", ns_div, 1000.0 / ns_div);

    /* 4. Benchmark: q64_sqrt (Newton-Raphson) */
    q64_t val = q64_from_int(2); // sqrt(2)
    clock_gettime(CLOCK_MONOTONIC, &start);
    q64_t acc4 = 0;
    for (long i = 0; i < BENCH_ITERATIONS; i++) {
        acc4 += q64_sqrt(val);
    }
    clock_gettime(CLOCK_MONOTONIC, &end);
    sink = acc4;
    double ns_sqrt = get_elapsed_ns(start, end) / (double)BENCH_ITERATIONS;
    printf("[BENCHMARK] q64_sqrt     : %6.2f ns/op (%8.2f M ops/sec)\n", ns_sqrt, 1000.0 / ns_sqrt);

    (void)sink;
    return 0;
}
