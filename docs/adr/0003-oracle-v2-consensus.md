# ADR 0003: Oracle v2 Consensus & Consumer Safety Decoupling

- **Status:** Accepted
- **Date:** 2026-10-23
- **Deciders:** Hansen Core Engineering
- **Technical Domains:** On-Chain Consensus, Oracle Systems, Risk Architecture
- **Supersedes:** ADR 0001, ADR 0002

---

## 1. Context & Problem Statement

ADR 0001 and ADR 0002 addressed key operational issues in v1, but preserved two critical structural weaknesses:

1. **Single-Publisher Ingestion (ADR 0001):** Although admin and publisher keys were decoupled, prices remained the assertion of a single key. A compromised key can walk the reported price by 500 bps per slot (approx. +63% within 60 seconds).
2. **Breaker Halts Price (ADR 0002):** ADR 0002 proposed per-symbol quarantine bands, but kept the core anti-pattern: rejecting price updates during volatile moves. During genuine market crashes, halting price updates blinds liquidators and causes bad debt in downstream money markets. Additionally, ADR 0002 had calculation flaws: potential uint32 overflow in delta-time scaling, undefined rounding in deviation calculations, and quarantine state flapping.

---

## 2. Decision

We replace single-key price submission and on-chain circuit breaker halts with multi-publisher consensus and decoupled consumer safety:

> **The oracle reports truth and confidence; downstream consumers enforce freeze policies.**

### 2.1 Multi-Publisher Submission Accounts
Publishers do not write into a shared account. Each authorized publisher commits quotes into its own dedicated `Submission` account. This removes transaction lock contention and avoids write serialization bottlenecks.

### 2.2 Permissionless Aggregation Crank
An unprivileged crank invokes `AGGREGATE` per feed. The contract validates publisher active status, verifies freshness against the slot timestamp, and runs a deterministic two-pass median.

### 2.3 Two-Pass Robust Median & Dispersion
- **Pass 1:** Calculate raw median across active submissions within the allowed freshness window (`block_ts - 30s` to `block_ts + 5s`).
- **Outlier Pruning:** Remove quotes deviating more than `outlier_bps` (default 100 bps for majors, 30 bps for stablecoins) from the Pass 1 median.
- **Pass 2:** Compute canonical median across the filtered set. Requires minimum quorum $M \ge 3$. If remaining quotes $< M$, state is set to `NO_CONSENSUS` and the previous price is preserved.
- **Confidence Interval:** Derive confidence using Median Absolute Deviation (MAD) scaled to basis points.

### 2.4 Informational Flags (Non-Halting)
The contract marks risk flags on the feed without rejecting consensus prices:
- `0x01: STALE` — Quorum update delayed beyond heartbeat threshold.
- `0x02: BIG_MOVE` — Price delta $\ge 300\text{ bps}$ relative to previous commit.
- `0x04: LOW_CONFIDENCE` — Dispersion exceeds threshold.
- `0x08: OUTLIER_REJECTED` — One or more publisher quotes were pruned in Pass 1.

### 2.5 Consumer Safety Kit
Downstream protocols (lending, perps) integrate `thru_oracle_consumer.h`. Each protocol chooses its own tolerance: rejecting stale feeds, widening spreads on `BIG_MOVE`, or pausing borrow originations while preserving liquidation paths.

### 2.6 Governance & Timelock
Parameter adjustments require an M-of-N multisig and a 24-hour timelock queue. Per-symbol emergency pause can be executed immediately by the multisig to isolate broken assets.

### 2.7 Integer-Only RV64IMC Runtime
No floating-point operations. All calculations use fixed-point integers (8 decimals / bps / Q64.64) with saturating arithmetic.

---

## 3. Consequences

### Positive
- Resilience against up to $\lfloor(N-1)/2\rfloor$ malicious or malfunctioning publishers.
- Price updates continue during market shocks, allowing orderly liquidations.
- Zero write contention between publishers.
- Full provenance: each feed update links to contributor slots and emits an event.

### Negative / Trade-Offs
- Crank execution required to finalize aggregated prices.
- Higher compute unit usage for sorting and MAD calculation (measured and budgeted in runtime benchmark protocol).
- Downstream protocols must integrate the consumer safety library rather than reading raw storage offsets.
