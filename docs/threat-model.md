# Threat Model: Thru Quant Core (Market Oracle & Risk Engine)

**Target Component:** `src/market_oracle.c` (RISC-V RV64IMC), `feeder/`, `api/`  
**Security Framework:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)  
**Contract Version:** v1.0.0 (Single-Publisher with Collar Bounds)

---

## 1. System Architecture & Trust Boundaries

The Thru Quant Core Oracle delivers multi-asset financial price feeds on the Thru Network. Downstream consumers (e.g. lending protocols, derivatives contracts, quant execution engines) read packed binary state (`oracle_account_data_t`, 948 bytes) from the oracle's storage account.

```
[ Market Data Sources ]
         │ (HTTP / WebSocket)
         ▼
[ Feeder Daemon (Hot) ]
         │ (Signed Transaction: Ed25519)
═════════╪══════════════════════════════════════════════════════ Trust Boundary 1 (Transport)
         ▼
[ Thru Network RPC / Validators ]
         │ (Consensus Block / Syscall Execution)
═════════╪══════════════════════════════════════════════════════ Trust Boundary 2 (VM Sandbox)
         ▼
[ Market Oracle Program (C RV64IMC) ]
         │ (Direct Account Memory Write)
         ▼
[ Oracle State Account (948 Bytes) ]
         │ (Zero-Copy Syscall / RPC Read)
═════════╪══════════════════════════════════════════════════════ Trust Boundary 3 (Consumption)
         ▼
[ API Daemon / SDK / Downstream DeFi ]
```

---

## 2. Trust Model & Assumptions

1. **Single Authority Model (v1 Scope):**
   - The oracle program enforces that instructions modifying state (`UPDATE_PRICES`, `RESUME`, `REBASE`) must be signed by `authority_pubkey` recorded at initialization (`0x2003`).
   - *Limitation:* If `authority_pubkey` is compromised, an attacker can post malicious quotes. However, price manipulation within a single block remains hard-capped by the 500 bps collar (`0x2007`), preventing sudden liquidation wicks.
   - *Roadmap to v2:* Multi-publisher BFT median aggregation will replace the single-authority design.

2. **Network Clock & Syscall Reliability:**
   - The contract relies on `tsys_clock_get_unix_ts` for block timestamp.
   - If the clock syscall returns an error code or regression (`clock_ts < last_update_ts`), the contract fails closed (`0x200D`).

3. **Storage Account Invariants:**
   - Account data length is fixed at 948 bytes (`oracle_account_data_t`).
   - Initialization is one-time only; re-initialization is rejected (`0x2008`).

---

## 3. STRIDE Threat Analysis Matrix

| STRIDE Category | Threat Description | Severity | Contract / Engine Mitigation | Status Code / Test Vector |
| :--- | :--- | :---: | :--- | :--- |
| **Spoofing (S)** | Unauthorized address attempts to post price updates, unpause circuit breaker, or trigger rebase. | High | Contract checks `tsdk_is_signer(acc_idx)` and compares fee payer/signer pubkey against stored `authority_pubkey`. | Reverts `0x2003` (`ORACLE_ERR_UNAUTHORIZED`). Tested in `test_unauthorized_update_rejection`. |
| **Spoofing (S)** | Attacker passes spoofed or unallocated account index to oracle instruction. | High | Validation via `tsdk_is_account_idx_valid(acc_idx)` before accessing account metadata or storage pointer. | Reverts `0x2004` (`ORACLE_ERR_DATA_ACCESS_FAILED`). |
| **Tampering (T)** | Malicious or buggy feeder injects extreme price wick (e.g. flash loan or compromised source). | Critical | Pre-validation collar checks percentage deviation against existing quote. If $\| \Delta P / P \| > 500$ bps (5%), updates are blocked and breaker trips. | Trips breaker, persists flag, reverts updates with `0x2007`. Tested in `test_circuit_breaker_persistence`. |
| **Tampering (T)** | Attacker submits quote with stale or zero timestamp to overwrite historical states. | Medium | Monotonic validation: `quote.ts > entry.ts` and `quote.ts > last_update_ts`. Max age capped at 120s; future skew capped at 30s. | Reverts `0x2009` (`STALE_TIMESTAMP`), `0x200A` (`FUTURE_SKEW`), `0x200E` (`ENTRY_TIMESTAMP`). |
| **Tampering (T)** | Attacker posts zero price or malformed Q64.64 representation. | High | Rejects `price_q64_hi == 0 && price_q64_lo == 0`. Validates valid symbol IDs ($1 \le ID \le 32$) and duplicate symbol checks. | Reverts `0x200C` (`INVALID_PRICE`), `0x200B` (`DUPLICATE_SYMBOL`), `0x2010` (`INVALID_SYMBOL`). |
| **Repudiation (R)** | Operator disputes whether a specific price batch was published by feeder. | Low | All on-chain writes are cryptographically signed on the Thru ledger. Feeder maintains local append-only hash log (`feeder_audit.log`). | Verifiable via transaction hash and slot metadata on-chain. |
| **Information Disclosure (I)** | Front-running pending price updates from mempool. | Medium | Thru network executes transactions in deterministic slot batches. Quotes update internal state; CLOB and downstream execution observe updated state at slot boundaries. | Public readback is intentional design; state account has public read permissions. |
| **Denial of Service (D)** | Attacker spams re-initialization to overwrite active oracle state. | Critical | Contract inspects `version` field in existing account. If `version != 0`, re-init is blocked. | Reverts `0x2008` (`ORACLE_ERR_ALREADY_INITIALIZED`). Tested in `test_double_initialization_blocked`. |
| **Denial of Service (D)** | Malicious market feed triggers false circuit breaker trips repeatedly. | High | Feeder runs internal baseline verification and suppresses single-source spikes. Reset requires authorized `RESUME` (if transient) or `REBASE` (if structural). | Feeder transitions to `HOLD` state; operator triage documented in `docs/runbook.md`. |
| **Denial of Service (D)** | API daemon SSE stream exhaustion via connection spam. | Medium | Daemon enforces `SetWriteDeadline(15s)` on SSE streams and disconnects unresponsive subscribers. | Handled in `api/sse.go`; Prometheus `/metrics` exports `active_sse_subscribers`. |
| **Elevation of Privilege (E)** | Non-authority caller attempts to clear tripped breaker via `RESUME` or `REBASE`. | Critical | `handle_resume` and `handle_rebase` enforce `tsdk_is_signer` check against `authority_pubkey`. | Reverts `0x2003`. Tested in `test_unauthorized_rebase_rejection`. |
| **Elevation of Privilege (E)** | Calling `RESUME` when breaker is not tripped. | Low | Guard requires `circuit_breaker_active == 1`. | Reverts `0x2011` (`ORACLE_ERR_NOT_TRIPPED`). |

---

## 4. Contract Guard Mapping (Error Registry)

| Code | Identifier | Trigger Condition | Test Coverage |
| :---: | :--- | :--- | :--- |
| `0x2001` | `ORACLE_ERR_INVALID_INSTR_SIZE` | Payload byte length smaller than expected instruction header. | `test_invalid_instruction_size` |
| `0x2002` | `ORACLE_ERR_INVALID_INSTR_TYPE` | Unknown opcode ($> 3$). | `test_unknown_opcode_rejection` |
| `0x2003` | `ORACLE_ERR_UNAUTHORIZED` | Transaction signer does not match `authority_pubkey`. | `test_unauthorized_update_rejection` |
| `0x2004` | `ORACLE_ERR_DATA_ACCESS_FAILED` | Account index out of bounds or memory access invalid. | `test_invalid_account_index` |
| `0x2005` | `ORACLE_ERR_ACCOUNT_INIT_FAILED`| System call to create account returned non-zero code. | `test_account_creation_failure` |
| `0x2006` | `ORACLE_ERR_INVALID_COUNT` | Number of entries in payload is 0 or exceeds 32. | `test_invalid_entry_count` |
| `0x2007` | `ORACLE_ERR_CIRCUIT_BREAKER` | Price deviation $\| \Delta P / P \| > 500$ bps; updates blocked. | `test_circuit_breaker_persistence` |
| `0x2008` | `ORACLE_ERR_ALREADY_INITIALIZED`| Initialize called on account with `version != 0`. | `test_double_initialization_blocked` |
| `0x2009` | `ORACLE_ERR_STALE_TIMESTAMP` | Quote timestamp is older than current block clock by $> 120$s. | `test_stale_timestamp_rejection` |
| `0x200A` | `ORACLE_ERR_FUTURE_SKEW` | Quote timestamp exceeds current block clock by $> 30$s. | `test_future_skew_rejection` |
| `0x200B` | `ORACLE_ERR_DUPLICATE_SYMBOL` | Same `symbol_id` appears more than once in batch. | `test_duplicate_symbol_rejection` |
| `0x200C` | `ORACLE_ERR_INVALID_PRICE` | Quote price Q64.64 is zero. | `test_zero_price_rejection` |
| `0x200D` | `ORACLE_ERR_CLOCK_UNAVAILABLE` | Syscall clock fails or reports timestamp regression. | `test_clock_fail_closed` |
| `0x200E` | `ORACLE_ERR_ENTRY_TIMESTAMP` | Incoming quote timestamp is less than or equal to existing entry timestamp. | `test_monotonic_timestamp_regression` |
| `0x200F` | `ORACLE_ERR_SYMBOL_CAPACITY` | Array boundary overflow during state resize. | `test_symbol_capacity_bounds` |
| `0x2010` | `ORACLE_ERR_INVALID_SYMBOL` | `symbol_id == 0` or invalid index. | `test_invalid_symbol_id` |
| `0x2011` | `ORACLE_ERR_NOT_TRIPPED` | `RESUME` invoked when `circuit_breaker_active == 0`. | `test_resume_when_not_tripped` |
| `0x2012` | `ORACLE_ERR_INVALID_REGIME` | `regime_id > 3` passed in payload. | `test_invalid_regime_rejection` |
| `0x2013` | `ORACLE_ERR_RESIZE_FAILED` | Account data resize syscall returned non-zero. | `test_resize_failure_handling` |

---

## 5. Residual Risks & Roadmap

1. **Key Compromise:**
   - *Residual Risk:* A compromised hot publisher key can submit price moves within 500 bps every slot.
   - *Operational Mitigation:* Feeder private key must be stored in KMS or encrypted filesystem; authority admin key (used for `RESUME` and `REBASE`) must be isolated on an air-gapped machine or hardware key.
   - *Protocol Roadmap (v2):* Migrate from single authority to $M$-of-$N$ threshold signatures (BLS/Ed25519) and on-chain medianizer.

2. **Downstream Unchecked Consumption:**
   - *Residual Risk:* Downstream protocols reading `oracle_account_data_t` without checking `circuit_breaker_active` or `last_update_ts` may consume stale prices during a halt.
   - *Integration Requirement:* Downstream consumers MUST assert `circuit_breaker_active == 0` and `(clock_now - last_update_ts) < 120` before using prices in liquidation or settlement logic.
