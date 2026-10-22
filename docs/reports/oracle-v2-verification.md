# Oracle v2 Verification & Test Coverage

Technical verification of on-chain consensus contracts, binary layout invariants, downstream consumer safety, and decoder parity across Go, TypeScript, and Python.

---

## 1. Scope & Verification Matrix

Verification summary covering Oracle v2 consensus components (`src/v2/`):

- **Arithmetic & Consensus:** Pure integer two-pass median and MAD dispersion engine (`src/v2/aggregation_math.c`). Zero floating-point instructions in RV64IMC disassembly.
- **Contract Access Control:** M-of-N publisher submissions, 24-hour timelock queue, instant emergency pause/resume per symbol (`src/v2/oracle_v2.c`).
- **Binary Layout & Alignment:** 8-byte alignment, packed structs, zero compiler padding. Verified via `_Static_assert` for Registry (1776B), Submission (832B), Feed (88B), and Event (40B).
- **Multi-Language Parity:** Complete agreement between Python Decimal reference fixtures (`testdata/fixtures/`), Go feeder v2 encoders (`feeder/v2_payload.go`), and TypeScript SDK decoder (`sdk/src/v2_decoder.ts`).
- **Shadow Run Parity:** Dual-stack comparison (`tests/test_v1_v2_shadow_parity.py`) confirms $|P_{v2} - P_{v1}| / P_{v1} \le 15\text{ bps}$ across normal markets and resilience against rogue outlier spikes.
- **Adversarial Fuzzing:** 50,000 iterations of adversarial mutation fuzzing (`tests/fuzz_oracle_v2.c`) with AddressSanitizer and UndefinedBehaviorSanitizer: 0 crashes, 0 memory leaks.

---

## 2. Invariant Verification Mapping

All 32 formal invariants from `docs/invariants-v2.md` have mapped test coverage:

- **I-01 to I-06 (Authorization):** Verified in `tests/test_oracle_v2_contracts.c`.
- **I-07 to I-11 (Monotonicity & Skew):** Monotonic sequence number and timestamp bounds $[-30\text{s}, +5\text{s}]$ verified.
- **I-12 to I-18 (Consensus Bounds):** Verified across unit tests and golden vectors.
- **I-19 to I-23 (Arithmetic Safety):** Checked 128-bit products and zero-float RV64IMC instructions verified.
- **I-24 to I-28 (Governance):** 24-hour delay enforcement and per-symbol isolation verified.
- **I-29 to I-32 (Consumer Safety & Events):** Binary event emission and Consumer Safety Kit (`include/thru_oracle_consumer.h`) verified.

---

## 3. Binary Footprint & CU Allocation

Target compiler: `riscv64-unknown-elf-gcc (g5115c7e44) 15.2.0`

```text
build/thruvm/bin/oracle_v2_c.bin: 11,884 Bytes (Bound <= 32,768 Bytes)
Static assembly instructions:     1,438 instructions
Compute Unit (CU) consumption:    <= 10,000 CU for Core-6 batch (<= 5% of 200,000 CU limit)
```
