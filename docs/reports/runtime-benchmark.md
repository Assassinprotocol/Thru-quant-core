# Runtime Benchmark Report: Oracle v2 Aggregation

Empirical performance, compute unit evaluation, and ISA boundary verification on Thru Betanet runtime (RV64IMC).

---

## 1. Executive Summary

This report documents the empirical benchmark results for the Oracle v2 two-pass median and Median Absolute Deviation (MAD) dispersion engine.

- **Kill-Criterion K-10a Evaluation:** **PASSED**
  - Actual measured footprint: $\approx 1{,}500\text{ to } 2{,}500\text{ CPU cycles}$ ($\le 10{,}000\text{ CU}$) for Core-6 batch aggregation across 5 publishers.
  - Budget ceiling: $\le 50\%$ of 200,000 CU block transaction limit ($100{,}000\text{ CU}$).
  - Actual consumption is $\le 5\%$ of the limit. Batch aggregation of Core-6 within a single transaction is officially approved.

---

## 2. Microbenchmark Performance Matrix

Measured with $1{,}000{,}000$ iterations per matrix cell using `-O3` optimization with AddressSanitizer and UndefinedBehaviorSanitizer enabled:

| Publishers ($N$) | Latency per Symbol | Core-6 Batch Latency | 16-Symbol Batch Latency | Throughput |
|:---:|:---:|:---:|:---:|:---:|
| **$N = 3$** | 292.88 ns | 1.76 µs | 4.69 µs | 569.1K batches/sec |
| **$N = 5$** | 333.16 ns | 2.00 µs | 5.33 µs | 500.3K batches/sec |
| **$N = 7$** | 621.80 ns | 3.73 µs | 9.95 µs | 268.0K batches/sec |

---

## 3. RISC-V 64 Compilation & ISA Boundary Verification

Target compiler: `riscv64-unknown-elf-gcc (g5115c7e44) 15.2.0`  
Compilation flags: `-std=c17 -march=rv64imc_zba_zbb_zbc_zbs_zknh -mabi=lp64 -mcmodel=medlow -mstrict-align -O3`

- **Binary Text Size:** 1,774 bytes (1.73 KB).
- **Static Assembly Instruction Count:** 597 instructions total (including inlined sort, two-pass median, outlier filter, residual sort, MAD calculation, and flags).
- **Floating-Point Audit:** Verified zero floating-point opcodes (`fadd`, `fsub`, `fmul`, `fdiv`, `flw`, `fsw`, `fld`, `fsd`).
- **Memory Allocations:** Zero heap allocations (`malloc`, `calloc`). Fixed stack buffer allocation of $7 \times 8 = 56\text{ bytes}$.

---

## 4. Locked Configuration Constants

Based on measured bounds, the following constants are locked for on-chain contracts:

```c
#define ORACLE_V2_MAX_PUBLISHERS        7
#define ORACLE_V2_MIN_QUORUM            3
#define ORACLE_V2_MAX_FEEDS             32
#define ORACLE_V2_CU_BUDGET_PER_SYMBOL  5000
#define ORACLE_V2_CU_BUDGET_CORE6       30000
```
