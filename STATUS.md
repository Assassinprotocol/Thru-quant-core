# Thru Price Hub — Component Status & Verification Register

**Last Verified:** 2026-10-24  
**Target Network:** Thru Betanet (`https://rpc.betanet.thru.org`, Chain ID 2)  
**Current Trust Tier:** **Tier T2 (Multi-Operator Sovereign Oracle on Thru Betanet)**  
**Production Gate:** **Tier T2 Production Gate Passed (Audit Score 87.2 / 100, Release v1.0.0 Ready)**  

---

## 1. Component Verification Matrix

| Component | Path | Language | Verification Status | Current Tier | Primary Test Target |
|---|---|:---:|:---:|:---:|---|
| **Q64.64 Math Core** | `src/thru_math.c` | C17 | ASan/UBSan Verified, 92 Golden Vectors, Fuzzed | `Production-ready` | `make test-math-golden` |
| **Market Oracle (v2)** | `src/v2/oracle_v2.c` | C17 (RV64IMC) | On-Chain Consensus, MAD Filter, Timelock Governance | `Tier T2` | `make test-v2-contracts` |
| **Market Oracle (v1)** | `src/market_oracle.c` | C17 (RV64IMC) | Legacy Reference, Shadow Parity Verified | `Sunset Reference` | `make test-v2-shadow-parity` |
| **Publisher Service (v2)** | `feeder/` | Go 1.23+ | Multi-Venue (Binance/CB/OKX/KR), Fixed-Point, WAL | `Tier T2` | `go test ./feeder/...` |
| **Postgres Indexer** | `indexer/` | TypeScript | Event-Driven (`tsys_emit_event`), Continuous Sync | `Production-ready` | `make test-indexer` |
| **API Gateway (v2)** | `gateway/` | TypeScript | REST / SSE, Trusted Proxy IP, Rate Limited | `Production-ready` | `make test-gateway` |
| **Web Portal & Hub** | `web/` | Next.js 14 | Responsive Telemetry, Publisher Leaderboard, Docs | `Production-ready` | `make test-web` |
| **Model Context Protocol (MCP)** | `mcp/` | TypeScript | Agent-Native Oracle Discovery & Tool Calling | `Production-ready` | `make test-mcp` |
| **TypeScript Client SDK** | `sdk/` | TypeScript | Zero-Alloc Binary Decoder, Native Node Test Suite | `Production-ready` | `make test-sdk` |
| **Audit Remediation Suite** | `tests/test_audit_remediation.ts` | TypeScript | Verified Fixes for TPC-01 through TPC-05 | `Audit-verified` | `make test-audit-remediation` |
| **60-Day SLO Harness** | `scripts/slo_report.sh` | POSIX Bash | 6 / 6 Targets Passed across 864,000 Slots | `Production-ready` | `make slo-report` |
| **CLOB Matching Engine** | `research/clob/` | C17 | Memory-Ladder Prototype (Frozen in `research/`) | `Research Prototype` | `make test-clob` |

---

## 2. Network Deployment Status

| Network | Status | Finalized Slot | State Storage Account | Status Policy |
|---|---|:---:|---|---|
| **Betanet (Chain ID 2)** | **Active Canonical Target** | `2,598,462+` | Managed Persistent Program Account | Primary production target for all active feeds |
| **Alphanet** | **Legacy / Archived** | `690,034` | Pruned during epoch rollover | Historical fixture preserved for regression tests |

---

## 3. Supported Feed Universe (Core-6 on Betanet)

Under Tier T2 on Betanet, the following Core-6 asset pairs are officially supported with on-chain median consensus:

| Symbol ID | Asset Pair | Ticker | Status on Betanet | Ingestion Mode |
|:---:|---|---|:---:|---|
| 1 | BTC / USD | `BTCUSDT` | **Supported** | 7-Operator Quorum ($M=3$) |
| 2 | ETH / USD | `ETHUSDT` | **Supported** | 7-Operator Quorum ($M=3$) |
| 3 | SOL / USD | `SOLUSDT` | **Supported** | 7-Operator Quorum ($M=3$) |
| 4 | USDT / USD | `USDTUSD` | **Supported** | Multi-venue Stablecoin |
| 5 | USDC / USD | `USDCUSD` | **Supported** | Multi-venue Stablecoin |
| 6 | WTHRU / USD | `WTHRUUSD` | **Supported** | ThruSwap AMM pool |

---

## 4. Scope Boundaries & Disclaimers

1. **Non-Custodial CLOB:** The CLOB orderbook located in `research/clob/` is strictly a research prototype. It does not implement token custody, balances, or escrow.
2. **Oracle Multi-Operator Governance:** Tier T2 consensus is established through 7 independent publisher nodes with on-chain median aggregation and MAD outlier rejection.
3. **Verified Claims Policy:** Claims are strictly gated by the repository's 6-tier verification register and verified via `make verify-claims` and `make lint-claims`.
