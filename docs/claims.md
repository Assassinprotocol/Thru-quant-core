# Thru Quant Core — Claims & Verification Register

This register documents every technical claim made by the repository, mapping each claim to explicit, verifiable cryptographic and on-chain evidence.

All claims are classified using the repository's **6-Tier Verification Hierarchy**:
1. `Implemented` — Source code committed to repository.
2. `Host-tested` — Host unit tests pass with AddressSanitizer and UndefinedBehaviorSanitizer (`-fsanitize=address,undefined`).
3. `Target-built` — Program binary compiled for `rv64imc + picolibc` with verified SHA-256 hash.
4. `Runtime-verified` — State machine transitions and invariants pass within ThruVM simulator harness.
5. `Alphanet-verified` — Live on-chain transaction executed and confirmed via raw account storage readback.
6. `Production-ready` — Formal economic verification, third-party security audit, and settlement accounting complete.

---

## Technical Claims Matrix

| Claim | Status Tier | Proof & Verification Artifacts | Last Verified |
|---|:---:|---|:---:|
| **Q64.64 Deterministic Math** | `Host-tested`<br>`Target-built` | - Tested with host GCC and RISC-V GCC (`rv64imc`).<br>- Vector tests in `tests/test_thru_math.c`.<br>- Branchless magnitude shifts eliminate C99 UB. | 2026-10-14 |
| **Market Oracle Program Deployment** | `Alphanet-verified` | - Program ID: `taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR`<br>- ABI ID: `ta5vSXl_w-ELG9NgGLQFkWhBgbbN0zfjcBNy3QzeYtNBZ4`<br>- State Account: `taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN` (948 Bytes). | 2026-10-14 |
| **Oracle Multi-Asset Streaming** | `Alphanet-verified` | - Streamed 28 crypto assets in single batch.<br>- Tx Hash: `tsFc6GmKmTkOy0XNnPcMa0obikfuJN252FAfE9QM7MDdGE8ohsbouRwP_zK7WSWBTrBm-THa5LzjHvztyxwtGXACTp`<br>- Slot: `7743340`. | 2026-10-14 |
| **Circuit Breaker Persistence** | `Host-tested`<br>`Alphanet-verified` | - Pure read-only pre-validation scan.<br>- Canonical `TSDK_SUCCESS` commit on trip.<br>- Test vectors in `tests/test_contracts.c` & `tests/test_simulation.c`. | 2026-10-15 |
| **CLOB Reference Matching Engine** | `Alphanet-verified`<br>*(Prototype)* | - Program ID: `ta-0HvoxEgLocbOZNZ9esb7A9qGfKvdwPeOr1eHtDRhP37`<br>- ABI ID: `tacZqSWnYV00RwdYVkvkZU-7CEC0eGqAgM5SgknMVjH0Xb`<br>- State Account: `talxErrmxdDsQU7VFoIo4l7NVs0q9RgK6dd4Gc0HV59xbU` (37,924 Bytes).<br>- Crossing Ask Match Tx: `ts0IyUGWsZUwinRbe7bVlIeOXNoYsZUY0nQujro18HdV_uGPXAsehEsevMryrdUqkV4VCvOIeV6maO6puFye-3BCIP` (Slot `7743774`). | 2026-10-14 |
| **CLOB Anti-DoS Min Notional Gate** | `Host-tested`<br>`Target-built` | - Rejects orders below `min_notional` before matching or insertion.<br>- Validated in `tests/test_contracts.c`. | 2026-10-14 |
| **Binary Memory State Decoder** | `Host-tested`<br>`Runtime-verified` | - Go binary decoder deserializes 948B packed `oracle_account_data_t` in **3.56 µs** (~280k ops/sec).<br>- Validated against raw on-chain test vectors in `api/decoder_test.go` and `api/decoder_benchmark_test.go`. | 2026-10-15 |
| **Operational Probes & Incident Tooling** | `Host-tested`<br>`Runtime-verified` | - Liveness (`/health`) decoupled from Readiness (`/ready`).<br>- Feeder `--resume` CLI generates authorized unpause instructions.<br>- Documented in `docs/runbook.md`. | 2026-10-15 |
| **Live Developer Console & Telemetry** | `Host-tested`<br>`Runtime-verified` | - Live developer web console with `/ready` status, dynamic decoder latency metrics, and operational telemetry grid.<br>- Validated via `make test-api` and `scripts/verify_reproduce.sh`. | 2026-10-15 |
| **Custody, Balances & Escrow** | `Not Implemented` | - **Explicit Out-of-Scope Boundary:** CLOB operates purely on memory-ladder order matching; no financial balances, token escrow, or settlement guarantees exist. | N/A |

---

## On-Chain Program Registry

### Active Target: Betanet (RPC: `https://rpc.betanet.thru.org`, Chain ID 2)
```text
Target Environment:      Thru Betanet (Slot 2,598,462+)
Registry File:           deploy/deployed.json
Supported Feeds:         Core-6 (BTC, ETH, SOL, USDT, USDC, WTHRU)
Trust Tier:              Tier T0 (Experimental, Single-Publisher)
Evidence Directory:      docs/evidence/betanet/
```

### Archived Evidence: Alphanet (Historic Slot 7743340)
```text
Market Oracle Program:   taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR
Market Oracle ABI:       ta5vSXl_w-ELG9NgGLQFkWhBgbbN0zfjcBNy3QzeYtNBZ4
Market Oracle State:     taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN (948 Bytes)

CLOB Engine Program:     ta-0HvoxEgLocbOZNZ9esb7A9qGfKvdwPeOr1eHtDRhP37
CLOB Engine ABI:         tacZqSWnYV00RwdYVkvkZU-7CEC0eGqAgM5SgknMVjH0Xb
CLOB Engine State:       talxErrmxdDsQU7VFoIo4l7NVs0q9RgK6dd4Gc0HV59xbU (37,924 Bytes)
Evidence Directory:      docs/evidence/alphanet/
```
