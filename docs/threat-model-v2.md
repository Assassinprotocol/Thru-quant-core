# Oracle v2 Threat Model

Security boundaries, attack vectors, and protocol mitigations for Thru Price Hub v2.

---

## 1. Trust Boundaries

```text
  [ External Data Venues (Binance, Coinbase, OKX, Kraken) ]
                             │  (Untrusted Public Internet)
  ═══════════════════════════╪═════════════════════════════════════════════ Boundary 1
  [ Independent Publishers (A, B, C) ] ── (Hot Signing Keys)
                             │  (Signed Submissions via RPC)
  ═══════════════════════════╪═════════════════════════════════════════════ Boundary 2
  [ Thru Chain / RV64IMC Engine ]
    ├─ Registry Account PDA (Admin Multisig, Publisher Table)
    ├─ Submission Accounts PDAs (Isolated per publisher)
    └─ Feed Accounts PDAs (Canonical median, MAD confidence, flags)
                             │
  ═══════════════════════════╪═════════════════════════════════════════════ Boundary 3
  [ Downstream Consumers (Lending Protocols, Perps, Arbitrageurs) ]
    └─ Consumer Safety Library (Owner checks, staleness, flags policy)
```

---

## 2. STRIDE Assessment

| Threat | Target | Vector | Severity | Mitigation |
|---|---|---|:---:|---|
| **Spoofing** | Submissions | Attacker signs price quote using forged publisher identity. | **Critical** | On-chain signature verification against active `publisher_pubkey` in registry. Unregistered keys revert. |
| **Spoofing** | Storage PDAs | Attacker constructs counterfeit feed account to deceive consumers. | **High** | PDAs derived from `[ProgramID, "feed", symbol_id]`. Consumer Safety Library verifies account owner equals ProgramID. |
| **Tampering** | Aggregation Crank | Miner/validator reorders submission accounts in transaction payload. | **Medium** | Aggregation logic sorts quotes prior to median evaluation; output is permutation-invariant (I-14). |
| **Tampering** | Account Memory | Attacker triggers buffer overflow via oversized input arrays. | **High** | Fixed array bounds ($N \le 7$, $F \le 32$), 8-byte alignment, checked bounds on loop iterators. |
| **Repudiation** | Submissions | Corrupt publisher denies broadcasting a bad quote. | **Low** | Sequence counters and signatures committed to immutable on-chain state and emitted in transaction events. |
| **Information Disclosure** | Pending Submissions | Searcher front-runs crank using mempool submissions. | **Low** | Median reflects historical venue quotes; permissionless crank incentive leaves zero economic rent for sandwiching. |
| **Denial of Service** | Publisher Set | Multiple publishers go offline simultaneously. | **High** | Quorum requires $M \ge 3$ out of $N \le 7$. Up to $N - M$ publishers can fail without halting consensus. |
| **Denial of Service** | Emergency Pause | Attacker attempts to pause active feed without authorization. | **Critical** | `EMERGENCY_PAUSE_SYMBOL` gated behind Cold M-of-N multisig authorization. |
| **Privilege Escalation** | Publisher Key | Hot feeder key attempts to rebase prices or alter parameters. | **Critical** | Role separation: Publisher keys only permitted to call `SUBMIT_PRICES` (`0x0002`). Admin opcodes revert. |
| **Privilege Escalation** | Upgrade Authority | Malicious actor replaces program bytecode. | **Critical** | Upgrade authority held by Cold Governance Multisig with 24h timelock; finalized/burned upon Tier T3 maturity. |

---

## 3. Attack Scenarios & Mitigations

### 3.1 Byzantine Publisher Collusion ($k$ of $N$)
- **$k < \lceil M / 2 \rceil$:** 1 rogue publisher injects a spike (+50%). Pass-1 median isolates the outlier. Outlier filter discards the quote ($\text{dev\_bps} \approx 5000\text{ bps} > 100\text{ bps}$). Pass-2 computes clean consensus.
- **$k = \lceil M / 2 \rceil$:** Colluders inject quotes just inside the 100 bps outlier band. The price drifts by at most 100 bps. Dispersion (MAD) widens, setting `FEED_FLAG_LOW_CONFIDENCE`.
- **$k \ge M$:** Byzantine supermajority. Mitigated operationally under Tier T2: publishers must be independent legal entities operating across distinct cloud providers and jurisdictions.

### 3.2 Clock Skew & Historical Replay
- Invariant I-07 enforces monotonic timestamps: $t_{\text{source}} \ge t_{\text{last\_source}}$. Replayed submissions revert.
- Invariant I-08 rejects quotes where $|t_{\text{source}} - t_{\text{block}}| > 30\text{s}$. A rogue validator forging block timestamps cannot ingest historical quotes without triggering bounds revert.

### 3.3 Front-Running Initialization
- In v1, PDA seed was generic (`"oracle_state"`), permitting front-run initialization.
- In v2, registry PDA is derived using the admin multisig pubkey as a seed component:
  $$\text{PDA} = \text{DeriveAddress}(\text{ProgramID}, [\text{"registry"}, \text{AdminMultisigPubkey}])$$
- A front-runner cannot claim the canonical address without holding the deployer's multisig key.

### 3.4 Upgrade Authority Hijacking
- Program upgrade authority is held by the M-of-N Cold Governance Multisig.
- Code upgrades require a multi-signer transaction and a mandatory 7-day timelock announced via on-chain event `EVENT_CONFIG_QUEUED`.
- Upgrade authority is permanently burned upon Tier T3 maturity, rendering the program immutable.

### 3.5 Consumer Misinterpretation
- Downstream protocols reading unvalidated storage offsets risk executing on stale data during outages.
- Mitigated by the official `Consumer Safety Kit` (`thru_oracle_consumer.h`), which enforces owner checks, slot age bounds, and flag parsing at the library level before returning a price.
