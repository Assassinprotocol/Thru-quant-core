# Oracle v2 Invariants

Core invariants and verification strategies for Oracle v2 consensus, monotonicity, arithmetic, and governance.

---

## 1. Access Control & Authorization

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-01** | Only registered publishers with `status == ACTIVE` can call `SUBMIT_PRICES`. | Unenrolled keys inject rogue price quotes. | Test: Call `SUBMIT_PRICES` with unknown key; expect `ERR_UNAUTHORIZED_PUBLISHER`. |
| **I-02** | Suspended or revoked publishers are excluded from aggregation cohorts immediately. | Compromised publisher continues influencing median. | Test: Revoke publisher in registry; verify subsequent `AGGREGATE` ignores its quotes. |
| **I-03** | `AGGREGATE` is callable by any unprivileged signer. | Oracle liveness depends on a single crank key. | Test: Invoke `AGGREGATE` from an empty ephemeral wallet with zero permissions. |
| **I-04** | Administrative instructions require valid M-of-N multisig signatures. | Single compromised admin key alters parameters. | Test: Submit admin instruction signed by $M-1$ keys; expect `ERR_MULTISIG_INSUFFICIENT`. |
| **I-05** | Two-step admin handover: pending keys hold zero privilege until `ACCEPT_ADMIN` is signed. | Premature governance takeover via proposed state. | Test: Verify pending admin key cannot execute admin instructions. |
| **I-06** | Storage PDAs reject cross-program writes by untrusted callers. | Rogue contract overwriting oracle state. | Test: Call contract via rogue CPI program; assert ownership validation failure. |

---

## 2. Monotonicity & Time Consistency

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-07** | Per-publisher `source_ts` must be strictly non-decreasing: $t_k \ge t_{k-1}$. | Replay of historical market quotes. | Test: Submit quote with $t < t_{\text{last}}$; expect `ERR_TIMESTAMP_REGRESSION`. |
| **I-08** | Submissions outside $[t_{\text{block}} - 30\text{s}, t_{\text{block}} + 5\text{s}]$ are rejected. | Stale or forward-dated quotes enter submission pool. | Test: Submit quotes at $-31\text{s}$ and $+6\text{s}$; expect `ERR_TIMESTAMP_OUT_OF_BOUNDS`. |
| **I-09** | Per-publisher `sequence_number` increments by 1 per successful submission. | Undetected batch loss or reordering. | Test: Verify counter increments monotonically over 1,000 submission cycles. |
| **I-10** | `feed.publish_slot` is monotonically non-decreasing: $S_{\text{current}} \ge S_{\text{prev}}$. | Time travel or slot regression in feed account. | Property test: Assert slot monotonicity across random crank execution orders. |
| **I-11** | `feed.median_source_ts` equals the median of accepted contributor timestamps. | Market observation time decoupled from reported slot. | Vector test: Compare on-chain timestamp against reference Python implementation. |

---

## 3. Consensus & Aggregation Bounds

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-12** | Canonical price is never overwritten if valid publisher count $< M$ (min quorum, default 3). | Low-liquidity manipulation or single-publisher dictate. | Test: Provide 2 submissions when $M=3$; assert price untouched, `FEED_FLAG_STALE` set. |
| **I-13** | Pass-2 median $M_2$ is strictly bounded: $\min(P_i) \le M_2 \le \max(P_i)$. | Price commits outside submitted range. | Fuzz test: 100,000 random inputs; assert median within $[\min, \max]$. |
| **I-14** | Permutation invariance: account input order does not alter the resulting median. | MEV searcher reordering accounts to change consensus. | Test: Permute input accounts across all permutations; assert identical hash and price. |
| **I-15** | Quotes deviating $> \text{outlier\_bps}$ from Pass-1 median are dropped in Pass-2. | Single extreme spike skews aggregated price. | Test: Inject $+150\text{ bps}$ quote with 100 bps threshold; assert quote dropped. |
| **I-16** | If remaining quotes after outlier filter $< M$, aggregation status is `NO_CONSENSUS`. | Price updated without sufficient consensus. | Test: 3 quotes, 1 outlier pruned, leaving 2 ($< M=3$); assert price preserved. |
| **I-17** | Median Absolute Deviation (MAD) is zero if and only if all quotes are identical. | Negative confidence or inverted dispersion. | Test: Run identical quotes ($MAD=0$) and disparate quotes ($MAD > 0$). |
| **I-18** | MAD dispersion is bounded: $\text{MAD} \le \max(P) - \min(P)$. | Unbounded dispersion metric corrupting downstream risk. | Fuzz test: Verify $\text{MAD} \le \text{spread}$ over $10^6$ iterations. |

---

## 4. Arithmetic & Memory Safety

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-19** | Zero floating-point instructions or registers in program binary (`rv64imc`). | Non-deterministic rounding across nodes. | CI Check: `llvm-objdump -d` verifies zero `fadd`, `fsub`, `fmul`, `fdiv` opcodes. |
| **I-20** | Price inputs must be strictly non-zero ($P_i > 0$). | Division by zero or corrupted asset pricing. | Test: Submit quote with price 0; expect `ERR_INVALID_PRICE_ZERO`. |
| **I-21** | Intermediate products ($|P_i - M| \times 10{,}000$) use checked 128-bit integers (`uint128_t`). | Wraparound overflow producing false small deviations. | Vector test: Test maximum allowable price ($P = 2^{63}-1$); assert zero overflow. |
| **I-22** | Division is explicitly guarded against zero denominators ($M_1 > 0$ and $M_2 > 0$). | Hardware CPU exception causing unhandled crash. | Static analysis & UBSan: Denominator non-zero check suite. |
| **I-23** | Timestamp difference calculations use saturating delta: $\Delta t = (t_2 > t_1) ? (t_2 - t_1) : 0$. | Negative timestamp subtraction underflow. | Test: Submit clock skew scenarios; verify saturating clamping. |

---

## 5. Governance & Lifecycle

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-24** | Config changes only take effect after the 24-hour timelock queue matures. | Instantaneous parameter rugpull. | Test: Call `APPLY_CONFIG` before 86,400 seconds elapse; expect revert. |
| **I-25** | Emergency pause on symbol $A$ does not affect symbol $B \neq A$. | Systemic freeze from an isolated feed issue. | Test: Pause BTC; execute ETH aggregation; assert ETH succeeds. |
| **I-26** | Paused feeds reject aggregation and maintain `STATUS_PAUSED`. | Price update during scheduled maintenance. | Test: Call `AGGREGATE` on paused feed; expect `ERR_FEED_PAUSED`. |
| **I-27** | Enrolled publisher count cannot exceed $N \le 7$. | Transaction compute unit exhaustion. | Test: Enrolling 8th publisher reverts with `ERR_MAX_PUBLISHERS_EXCEEDED`. |
| **I-28** | Timelock entries cannot be cancelled without valid multisig. | Single rogue operator cancelling governance actions. | Test: Cancel timelock without M-of-N keys; expect `ERR_UNAUTHORIZED`. |

---

## 6. Consumer Safety & Events

| ID | Invariant | Impact if Broken | Verification |
|:---:|---|---|---|
| **I-29** | Every successful `AGGREGATE` emits an `AggregateUpdated` event. | Indexer desynchronization and data loss. | Test: Intercept event logs; verify fields match ABI schema. |
| **I-30** | Informational flags (`BIG_MOVE`, `LOW_CONFIDENCE`) never abort consensus commits. | DeFi liquidations frozen during legitimate market moves. | Test: Simulate 500 bps move with 3 valid publishers; verify price commits with `BIG_MOVE`. |
| **I-31** | Consumer Safety Library rejects feed accounts with mismatched owner or `version != 2`. | Downstream protocols reading counterfeit accounts. | Test: Pass fake account to `thru_oracle_read_price()`; expect `ERR_INVALID_OWNER`. |
| **I-32** | Consumer Safety Library rejects feeds older than caller's `max_staleness_slots`. | Downstream protocol trading against dead feed. | Test: Mock aged slot; verify consumer library returns `ERR_STALE_PRICE`. |
