# Smart Contract & Financial Oracle Bug Class Checklist

Audit verification checklist addressing recognized vulnerabilities in on-chain oracles, fixed-point math, and consensus feeders.

---

## 1. Mathematical & Arithmetic Vulnerabilities

- [x] **Integer Overflow / Underflow:**
  - *Risk:* 64-bit integer wraparound during price scaling or confidence math.
  - *Mitigation:* `q64_add`, `q64_mul`, and `q64_div` utilize explicit overflow checks returning `Q64_OVERFLOW`. Verified by `tests/fuzz_math_diff.c` (200,000 iterations).
- [x] **Division by Zero:**
  - *Risk:* Crash or panic when calculating relative delta or division by zero confidence width.
  - *Mitigation:* Denominator non-zero assertions returning `Q64_DIV_BY_ZERO` in `thru_math.c`.
- [x] **Precision Loss & Truncation:**
  - *Risk:* Integer division truncation bias before multiplication.
  - *Mitigation:* Fixed-point Q64.64 intermediate arithmetic uses 128-bit accumulator (`__int128_t`) before right-shifting.

---

## 2. Oracle & Market Manipulation Risks

- [x] **Flash Loan Price Manipulation / Spurious Spikes:**
  - *Risk:* Single venue flash loan skewing reported spot price.
  - *Mitigation:* Minimum 3 independent spot venues; Median Absolute Deviation (MAD) filter strips quotes deviating $> 150\text{ bps}$ from median.
- [x] **Clock Skew & Replay Attacks:**
  - *Risk:* Malicious publisher replaying past low price during a crash.
  - *Mitigation:* On-chain contract enforces strict timestamp monotonicity (`INV-1`). Deserializer checks future skew ($> 30\text{s}$) and staleness ($> 120\text{s}$).
- [x] **Asymmetric Solvency Risk in Lending Protocols:**
  - *Risk:* Using raw mid-price allows toxic borrowers to over-borrow and under-collateralize.
  - *Mitigation:* SDK mandates $P - k \cdot \sigma$ for collateral valuation and $P + k \cdot \sigma$ for debt liabilities.

---

## 3. Consensus & Access Control

- [x] **Privileged Function Hijacking:**
  - *Risk:* Unauthorized actors invoking `ORACLE_INSTR_RESUME`, `FREEZE`, or `UPGRADE`.
  - *Mitigation:* Authority public key check pinned against account data header (`INV-5`).
- [x] **Sybil Publisher Collusion:**
  - *Risk:* Rogue operators attempting to shift consensus median.
  - *Mitigation:* Tier T2 enforces multi-operator threshold with independent validator key ceremony (`docs/runbooks/key-ceremony.md`).
- [x] **Timelock Governance Bypass:**
  - *Risk:* Instant execution of malicious contract upgrades.
  - *Mitigation:* 48-hour mandatory timelock delay on code upgrades (`docs/governance/upgrade-timelock.md`).

---

## 4. Memory Safety & Hardware Isolation

- [x] **Buffer Overflows & Memory Corruption:**
  - *Risk:* Memory safety exploits in C on-chain contract execution.
  - *Mitigation:* Strict AddressSanitizer (ASan) and UndefinedBehaviorSanitizer (UBSan) passed across all test harnesses; zero dynamic heap allocations in hot-path.
- [x] **Unbounded Loop Execution / CU Exhaustion:**
  - *Risk:* Large asset batches exceeding transaction compute unit limit.
  - *Mitigation:* Fixed ceiling of $\le 32$ symbols per account (`INV-6`), bounding iteration count to $O(N)$ with execution $< 45,000\text{ CU}$.
