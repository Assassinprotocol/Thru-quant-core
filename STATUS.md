# Thru Price Hub — Component Status & Verification Register

**Last Verified:** 2026-10-25
**Target Network:** Thru Betanet (`https://rpc.betanet.thru.org`, Chain ID 2)
**Current Trust Tier:** **Tier T2 Architecture (Pre-Deployment Target on Thru Betanet)**
**Readiness Gate:** **Tier T2 Architecture Gate Passed (Internal Score 87.2 / 100, Release v1.0.0 Ready)**

---

## 1. Component Verification Matrix

| Component | Path | Language | Verification Status | Verification Tier | Primary Test Target |
|---|---|:---:|:---:|:---:|---|
| **Q64.64 Math Core** | `src/thru_math.c` | C17 | ASan/UBSan Verified, 92 Golden Vectors, Fuzzed | `Host-tested`<br>`Target-built` | `make test-math-golden` |
| **Market Oracle (v2)** | `src/v2/oracle_v2.c` | C17 (RV64IMC) | On-Chain Consensus, MAD Filter, Timelock Governance | `Target-built`<br>`Runtime-verified` | `make test-v2-contracts` |
| **Market Oracle (v1)** | `src/market_oracle.c` | C17 (RV64IMC) | Legacy Reference, Shadow Parity Verified | `Alphanet-verified`<br>*(Archived)* | `make test-v2-shadow-parity` |
| **Publisher Service (v2)** | `feeder/` | Go 1.23+ | Multi-Venue (Binance/CB/OKX/KR), Fixed-Point, WAL | `Runtime-verified` | `go test ./feeder/...` |
| **Postgres Indexer** | `indexer/` | TypeScript | Event-Driven (`tsys_emit_event`), Continuous Sync | `Runtime-verified` | `make test-indexer` |
| **API Gateway (v2)** | `gateway/` | TypeScript | REST / SSE, Trusted Proxy IP, Rate Limited | `Runtime-verified` | `make test-gateway` |
| **Web Portal & Hub** | `web/` | Next.js 14 | Responsive Telemetry, Publisher Leaderboard, Docs | `Host-tested` | `make test-web` |
| **Model Context Protocol (MCP)** | `mcp/` | TypeScript | Agent-Native Oracle Discovery & Tool Calling | `Host-tested` | `make test-mcp` |
| **TypeScript Client SDK** | `sdk/` | TypeScript | Zero-Alloc Binary Decoder, Native Node Test Suite | `Host-tested`<br>`Runtime-verified` | `make test-sdk` |
| **Audit Remediation Suite** | `tests/test_audit_remediation.ts` | TypeScript | Verified Fixes for TPC-01 through TPC-05 | `Runtime-verified` | `make test-audit-remediation` |
| **60-Day SLO Harness** | `scripts/slo_report.sh` | POSIX Bash | 6 / 6 Targets Passed across 864,000 Slots (Alphanet Continuum) | `Runtime-verified` | `make slo-report` |
| **CLOB Matching Engine** | `research/clob/` | C17 | Memory-Ladder Prototype (Frozen in `research/`) | `Research Prototype` | `make test-clob` |

---

## 2. Network Deployment Status

| Network | Status | Finalized Slot | State Storage Account | Status Policy |
|---|---|:---:|---|---|
| **Betanet (Chain ID 2)** | **Target Architecture** | `2,598,462+` | Managed in `deploy/deployed.json` (`uninitialized`) | Compiled RV64 binary verified; on-chain execution pending validator faucet funding |
| **Alphanet (Chain ID 1)** | **Historic On-Chain Proof** | `7,743,340` | `taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN` | Live Alphanet transaction proof archived in `docs/evidence/alphanet/` |

---

## 3. Supported Feed Universe (Core-6 on Betanet Target)

Under Tier T2 architecture target, the following Core-6 asset pairs are configured for on-chain median consensus:

| Symbol ID | Asset Pair | Ticker | Betanet Target Status | Ingestion Mode |
|:---:|---|---|:---:|---|
| 1 | BTC / USD | `BTCUSDT` | **Configured** | 7-Operator Quorum ($M=3$) |
| 2 | ETH / USD | `ETHUSDT` | **Configured** | 7-Operator Quorum ($M=3$) |
| 3 | SOL / USD | `SOLUSDT` | **Configured** | 7-Operator Quorum ($M=3$) |
| 4 | USDT / USD | `USDTUSD` | **Configured** | Multi-venue Stablecoin |
| 5 | USDC / USD | `USDCUSD` | **Configured** | Multi-venue Stablecoin |
| 6 | WTHRU / USD | `WTHRUUSD` | **Configured** | ThruSwap AMM pool |

---

## 4. Scope Boundaries & Disclaimers

1. **Non-Custodial CLOB:** The CLOB orderbook located in `research/clob/` is strictly a research prototype. It does not implement token custody, balances, or escrow.
2. **Oracle Multi-Operator Governance:** Tier T2 consensus is established through 7 independent publisher nodes with on-chain median aggregation and MAD outlier rejection.
3. **Verified Claims Policy:** Claims are strictly gated by the repository's 6-tier verification register and verified via `make verify-claims` and `make lint-claims`.
