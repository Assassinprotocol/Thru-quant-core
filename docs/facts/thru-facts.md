# Thru Network Technical Facts & Environment Registry

**Status:** Canonical Reference  
**Version:** 1.0.0 (Betanet Baseline)  
**Last Verified Date:** 2026-10-21  
**Verification Method:** Empirical probe via `thru` CLI (v0.4.2+e47b2a21) & live RPC endpoints  

---

## 1. Network Topology & Endpoints

| Parameter | Betanet (Active Canonical Target) | Alphanet (Legacy / Historical) |
|---|---|---|
| **Status** | **ACTIVE TARGET (Chain ID 2)** | **LEGACY (Reset to Slot ~690k)** |
| **RPC URL** | `https://rpc.betanet.thru.org` | `https://rpc.alphanet.thru.org` |
| **Current Finalized Slot** | `2,598,462+` (as of 2026-10-21) | `690,034` (Reset from slot 7.74M+) |
| **Block Time** | `~6.0 seconds` (observed slot progression) | `~6.0 seconds` |
| **Consensus State** | Active (Regular mode) | Active (Regular mode) |
| **Deployer Account (`0xhansen`)** | `taIWL8iro1Jt8sNChWGgupC5tzqewzfjfSzp2pegCWYm0E` | `Account not found` (pruned in reset) |
| **Pre-Reset Oracle (`taWLmu...`)** | `Account not found` (Never deployed here) | `Account not found` (Pruned in reset) |
| **Historical Evidence Policy** | New canonical deployment target for v1/v2 | Preserved as frozen SHA-256 fixture (`slot_7743340.hex`) |

---

## 2. On-Chain Feature Gates & Chain Parameters (Betanet)

Directly queried from `thru --network betanet feature-gates list`:

| Index | Parameter Name | Kind | Current Value | State |
|:---:|---|---|:---:|:---:|
| 0 | `parallel_exec` | feature-gate | `inactive` | Inactive |
| 1 | `compressed_account_growth_v2` | feature-gate | `active` | **Active** |
| 2 | `max_compute_units_per_txn` | chain-param | **`42`** | Enforced |
| 3 | `max_state_units_per_block` | chain-param | **`8,192`** | Enforced |
| 4 | `max_active_state_units` | chain-param | **`11,272,193`** | Enforced |
| 5 | `compress_baseline_units` | chain-param | **`8,388,608`** | Enforced |
| 6 | `compress_halving_step_units` | chain-param | **`262,144`** | Enforced |

---

## 3. Core Ecosystem Programs (Betanet Registry)

Configured under `~/.thru/cli/config.yaml`:

| System Role | Canonical Program Public Key |
|---|---|
| **Uploader Program** | `taUPLMH5QYOAT4ktwQeO7DXAEKtqBhYehalNGf5BJFQDYq` |
| **Manager Program** | `taMGRmPoSTkUtF6UlmCIq58K8OYsnXshOMPdobxxHytqmu` |
| **ABI Manager Program** | `taABII8WXcPaPIt47cXjOBbyoBUGBDXznAMHorVMeok3mw` |
| **Token Program** | `taTOKENKRgcl3vO0yVhftATDbXuhgWcfaaxv9xpEEdMdUE` |
| **Wrapped Thru (WTHRU)** | `taWTHRUBelpONhTRjYc7n4OovodUsUtZKTIuREWAi9G9lm` |
| **Name Service Program** | `taNAMEqRNEDeMWp0cDYmMVdZyTZiF5NyGDR9zTwH42rWQG` |
| **Thru Registrar** | `taREGMtyyVIMr27zDpvN0aRiSS2aOVffM9cZCsc0Xomaxw` |
| **Block-Producer (BP) Bond** | `taBPUH9m3CXZcBQyCrTmclHtltipiPelIHzdAf8QdIDvnt` |

---

## 4. Official Compiler & ISA Specification

Directly extracted from `~/.thru/sdk/c/thru-sdk/config/machine/thruvm.mk`:

- **Target Architecture:** `rv64imc_zba_zbb_zbc_zbs_zknh`
  - Base: RV64I (64-bit integer ALU)
  - Extensions: M (Multiplication/Division), C (Compressed 16-bit instructions)
  - Bit-Manipulation Extensions: `_zba` (address generation), `_zbb` (basic bit-manipulation), `_zbc` (carryless multiplication), `_zbs` (single-bit instructions)
  - Cryptographic Extension: `_zknh` (NIST SHA-256 / SHA-512 hardware acceleration)
  - **Explicit Negative Space:** **NO `A` (Atomic), NO `F` (Single Float), NO `D` (Double Float)**.
  - Floating-point arithmetic on ThruVM is prohibited; all fixed-point math MUST use integer arithmetic (`q64_t`).
- **Toolchain Location:** `~/.thru/sdk/toolchain/bin/riscv64-unknown-elf-gcc`
- **Compiler Version:** `riscv64-unknown-elf-gcc 15.2.0`
- **C Standard:** `c17`
- **Embedded Libc:** `picolibc` (`-specs=picolibc.specs --picolibc-prefix=$(RISCV_TOOLCHAIN_ROOT)`)
- **Compilation Flags:** `-O3 -g -fno-stack-protector -ffreestanding -ffunction-sections -fdata-sections -nostartfiles -static-pie -fPIE -Werror -Wall -Wextra -Wpedantic -mstrict-align -mabi=lp64 -mcmodel=medlow`
- **Linker Entry:** `-e _start -T $(THRU_C_SDK_DIR)/config/link.ld -Wl,-gc-sections`
- **Binary Size Ceiling:** `< 32,768 Bytes (32 KB)`

---

## 5. Audit Verification Resolutions (V-01 to V-15)

| ID | Item | Empirically Verified Status | Resolution / Action |
|:---:|---|---|---|
| **V-01** | Target Chain & Alphanet Status | Betanet is at slot `2.59M+` (healthy, active). Alphanet was reset to slot `690k+`. Old accounts pruned. | **Betanet adopted exclusively.** |
| **V-02** | Ephemeral Account Semantics | Ephemeral accounts (`tsys_account_create_ephemeral`) are cleared upon epoch rollovers. `compressed_account_growth_v2` is active on Betanet. | **v2 oracle storage must use managed persistent accounts.** |
| **V-03** | Upgrade Authority & Finalize | Thru Manager natively supports `thru program finalize <SEED>` and 2-step handover (`set-authority` / `claim-authority`). | **Incorporate 2-step handover in v2 spec.** |
| **V-04** | Volatility Collar Bounds | [market_oracle.c:161](file:///home/hansen/AI/thru_quant_core/src/market_oracle.c#L161) evaluates strictly against previous slot entry without cumulative time bounds. Multi-tx creep attack is mechanically possible. | **On-chain median consensus (v2) supersedes collar.** |
| **V-05** | Event Emission & ABI | v1 uses `tsdk_printf` without `tsys_emit_event`. `market_oracle.abi.yaml` defines 948B layout. | **WP-15 introduces `tsys_emit_event` for indexer.** |
| **V-06** | Rate Limiter `X-Forwarded-For` | [api/server.go:210](file:///home/hansen/AI/thru_quant_core/api/server.go#L210) blindly trusts `X-Forwarded-For`. | **Fixed in WP-07 via `RemoteAddr` & trusted proxy check.** |
| **V-07** | Go Toolchain | `go.mod` specifies Go 1.22. | **Pinned to Go 1.23+ with govulncheck in WP-03.** |
| **V-08** | Documentation Drift | Historical docs cited `RV64IMAFD`. True ISA is `rv64imc_zba_zbb_zbc_zbs_zknh`. | **All docs updated to canonical facts.** |
| **V-09** | Claims Verification Script | [scripts/verify_onchain_claims.sh](file:///home/hansen/AI/thru_quant_core/scripts/verify_onchain_claims.sh) runs offline fixture tests; live RPC probe is non-blocking. | **Confirmed robust; zero CI failure on reset.** |
| **V-10** | C SDK & Toolchain Licensing | Thru C SDK is Apache-2.0 / MIT. Picolibc is BSD-3-Clause. blst is Apache-2.0. | **Documented in `docs/facts/licensing.md`.** |
| **V-11** | RV64IMC Reproducibility | `make build-rv64` outputs verified binaries < 32 KB on local toolchain. | **Containerized runner added in WP-03.** |
| **V-12** | Compute Units & State Limits | Chain param enforces `max_compute_units_per_txn = 42`. | **Benchmarking in WP-10 against 42 CU limit.** |
| **V-13** | Symbol Mapping Drift | FTM rebranded to S (Sonic). 32 slots contained long-tail pairs. | **Restricted to Core-6 universe in WP-00/WP-01.** |
| **V-14** | Venue Redistribution | Public tick data from CEX WebSockets used solely for off-chain median calculation. | **Provenance hashing in WAL (WP-18).** |
| **V-15** | Protocol State Size | Packed account struct is 948 Bytes (fits well within 32 KB program and state units). | **Preserve packed memory layout.** |
