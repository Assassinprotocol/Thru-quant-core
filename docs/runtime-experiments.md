# Runtime Experiments & Benchmark Protocol

Measurement protocol for Compute Units, multi-signer governance, and storage persistence on Thru Betanet (RV64IMC).

---

## 1. Overview

Before implementing Oracle v2 in C, all architectural assumptions must be confirmed empirically on Betanet. Each experiment defines an explicit pass/fail kill-criterion.

---

## 2. Experiments

### E-01: Compute Unit (CU) Footprint & Scaling Bounds

- **Objective:** Measure instruction cycle count and CU billing of two-pass median aggregation and MAD dispersion under `-O2 -march=rv64imc_zba_zbb_zbc_zbs_zknh`.
- **Matrix:** Publishers $N \in \{3, 5, 7\} \times \text{Symbols } S \in \{1, 6, 16\}$.
- **Kill-Criterion K-10a:**
  $$\text{CU}(N=5, S=6) \le 50\% \times \text{MaxTxCULimit}$$
  - **Pass:** Batch aggregation of Core-6 in a single transaction is approved.
  - **Fail:** Pivot to single-symbol granularity (`AGGREGATE(symbol_id)`).

### E-02: Governance M-of-N Multi-Signer Support

- **Objective:** Verify whether Thru Betanet natively supports multi-signature transactions within a single transaction header.
- **Procedure:** Construct a transaction signed by 3 distinct Ed25519 keys, inspect signer iteration syscalls.
- **Kill-Criterion K-10b:**
  - **Pass:** Multisig threshold is evaluated natively in `registry.c`.
  - **Fail:** Deploy a standalone multisig contract and authorize administrative writes via CPI.

### E-03: Account Persistence vs Ephemeral Semantics

- **Objective:** Verify storage account lifecycle and state retention across epoch rollovers.
- **Procedure:** Write a test payload to standard vs ephemeral accounts, monitor retention across $\ge 100{,}000$ slots.
- **Kill-Criterion K-10c (Stop-the-World Protocol):**
  - **Pass:** Standard accounts persist indefinitely without unexpected pruning or compression.
  - **Fail:** If state accounts are subject to automatic pruning or compression without archival retrieval, **HALT PHASE 2** immediately and escalate to Thru core engineering.

### E-04: Parallel Submission Contention

- **Objective:** Confirm that independent per-publisher submission PDAs execute concurrently without transaction lock aborts.
- **Procedure:** Spin up 5 concurrent publisher daemons submitting quotes to separate PDAs within the same slot.
- **Success Metric:** Zero `AccountInUse` / contention errors. 100% of submissions confirmed.

---

## 3. Benchmark Deliverables

1. Benchmark report (`docs/reports/runtime-benchmark.md`).
2. Finalized configuration constants (`MAX_PUBLISHERS`, `CU_BUDGET`).
