# Thru Quant Core — Empirical Performance Benchmarks

> [!NOTE]
> **Empirical Truth Policy**: All metrics in this document were measured using executable benchmark harnesses on host hardware across $\ge 10^7$ iterations (C math) and $\ge 3 \times 10^5$ iterations (Go decoder). No theoretical or synthetic marketing numbers are presented.

---

## 1. Test Environment Specification

- **Host CPU**: Intel(R) Core(TM) i7-10610U CPU @ 1.80GHz (8 vCPUs)
- **Host OS**: Linux (Kernel 6.18, x86_64)
- **C Compiler**: GCC 15.2.0 (`-O3`)
- **Go Toolchain**: Go 1.22+ (`go test -bench=. -benchmem`)
- **Target RISC-V**: RV64IMC (`riscv64-unknown-elf-gcc` 15.2.0 + picolibc)
- **Commit SHA**: `b8a06c4` (and descendants)

---

## 2. On-Chain Binary Memory Decoder (`api/decoder.go`)

Benchmarks measure the deserialization throughput for the packed 948-byte `oracle_account_data_t` structure containing 28 active asset quotes:

```bash
go test -bench=. -benchmem ./api
```

### Empirical Results

| Benchmark Function | Operations | Latency (ns/op) | Latency (µs/op) | Throughput (ops/sec) | Memory (B/op) | Allocations |
|---|---:|---:|---:|---:|---:|---:|
| `BenchmarkDecodeOracleAccountBytes` | 309,770 | **3,564 ns** | **3.56 µs** | **~280,500/sec** | 2,320 B | 4 allocs/op |
| `BenchmarkDecodeOracleAccountBase64` | 231,823 | **6,023 ns** | **6.02 µs** | **~166,000/sec** | 3,344 B | 5 allocs/op |

### Performance Analysis
- Deserialization of the entire 28-asset oracle state requires **less than 4 microseconds**.
- Memory allocations are constrained to the output `OracleState` and `[]OracleEntry` slice headers, avoiding heap fragmentation and GC pauses in high-frequency SSE push streaming.

---

## 3. Fixed-Point Mathematics Core (`src/thru_math.c`)

Benchmarks execute $10^7$ iterations per primitive with monotonic nanosecond timing:

```bash
make bench-math
```

### Empirical Results

| Mathematical Primitive | Iterations | Latency (ns/op) | Throughput (ops/sec) | Algorithmic Mechanism |
|---|---:|---:|---:|---|
| **`q64_from_int`** | 10,000,000 | **< 0.50 ns** | > 300 M/sec | Magnitude-safe bitwise shift |
| **`q64_mul`** | 10,000,000 | **10.82 ns** | **92.39 M/sec** | 128-bit unsigned product + Q64 limb split |
| **`q64_div`** | 10,000,000 | **142.78 ns** | **7.00 M/sec** | Three-stage limb division (no overflow) |
| **`q64_sqrt`** | 10,000,000 | **885.25 ns** | **1.13 M/sec** | Newton-Raphson convergence to $\epsilon$ |

---

## 4. Statistical Volatility Metric Specification

The feeder (`feeder/main.go`) calculates rolling asset volatility based on the sample standard deviation of log returns:

$$\text{Log Return } r_i = \ln\left(\frac{P_i}{P_{i-1}}\right)$$

$$\bar{r} = \frac{1}{N} \sum_{i=1}^{N} r_i$$

$$\sigma = \sqrt{\frac{1}{N-1} \sum_{i=1}^{N} (r_i - \bar{r})^2}$$

$$\text{Volatility (bps)} = \min\left(10{,}000, \; \text{round}(\sigma \times 10{,}000)\right)$$

### Statistical Rules & Boundary Guards:
1. **Minimum Sample Horizon**: $N_{\text{min}} = 10$. If fewer than 10 valid price points exist, `volatility_bps` is strictly set to `0`.
2. **Zero/Negative Price Handling**: Ignored during log-return calculation.
3. **Upper Bound Collar**: Clamped at `10,000 bps` (100.0% volatility) to prevent integer overflow in downstream risk equations.

---

## 5. Binary Footprint Specification

| Binary Artifact | Target ISA | Size (Bytes) | Size (KB) | Description |
|---|---|---:|---:|---|
| `market_oracle_c.bin` | RISC-V RV64IMC | 14,104 B | ~13.8 KB | On-Chain Oracle Program |
| `clob_engine_c.bin` | RISC-V RV64IMC | 15,863 B | ~15.5 KB | Reference Matching Engine |
| `thru_oracle_api` | x86_64 Linux | ~10 MB | 10.2 MB | REST / SSE Go Daemon |
| `oracle_account_data_t` | Packed Struct | 948 B | 0.93 KB | Storage Account Size |

---

## 6. How to Reproduce Benchmarks

```bash
# 1. Run C Fixed-Point Benchmark
make bench-math

# 2. Run Go Binary Decoder Benchmark
make bench-api
```
