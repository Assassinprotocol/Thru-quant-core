# Thru Price Hub — Component Status & Verification Register

**Last Verified:** 2026-10-21  
**Target Network:** Thru Betanet (`https://rpc.betanet.thru.org`, Chain ID 2)  
**Current Trust Tier:** **Tier T0 (Experimental, Single-Publisher)**  

---

## 1. Component Verification Matrix

| Component | Path | Language | Verification Status | Current Tier | Primary Test Target |
|---|---|:---:|:---:|:---:|---|
| **Q64.64 Math Core** | `src/thru_math.c` | C17 | ASan/UBSan Verified, 92 Golden Vectors | `Target-built` | `make test-math-golden` |
| **Market Oracle (v1)** | `src/market_oracle.c` | C17 (RV64IMC) | Unit Tested, Parser Fuzzed, Coverage 86.6% | `Tier T0` | `make test` |
| **Quorum Ingestion Feeder** | `feeder/quorum/` | Go 1.22 | 4-Venue Quorum Tested (Binance/CB/OKX/KR) | `Tier T0` | `go test ./feeder/...` |
| **Oracle API & Metrics Daemon** | `api/` | Go 1.22 | Race Tested, SSE Stream Tested, Cov 92.1% | `Tier T0` | `make test-api` |
| **TypeScript SDK** | `sdk/` | TypeScript | Unit Tested, Node.js v22 compatible | `Runtime-verified` | `make test-sdk` |
| **CLOB Matching Engine** | `research/clob/` | C17 | Price-Time Invariants Tested | `Research Prototype` | `make test-clob` |

---

## 2. Network Deployment Status

| Network | Status | Finalized Slot | State Storage Account | Status Policy |
|---|---|:---:|---|---|
| **Betanet (Chain ID 2)** | **Active Target** | `2,598,462+` | Redeployment scheduled (WP-05) | Primary target for all active feeds |
| **Alphanet** | **Legacy / Reset** | `690,034` | Pruned during epoch rollover | Archived; evidence verified via fixtures |

---

## 3. Supported Feed Universe (Core-6 on Betanet)

Under Tier T0 on Betanet, only the following Core-6 asset pairs are officially supported:

| Symbol ID | Asset Pair | Ticker | Status on Betanet | Ingestion Mode |
|:---:|---|---|:---:|---|
| 1 | BTC / USD | `BTCUSDT` | **Supported** | 4-Venue Quorum |
| 2 | ETH / USD | `ETHUSDT` | **Supported** | 4-Venue Quorum |
| 3 | SOL / USD | `SOLUSDT` | **Supported** | 4-Venue Quorum |
| - | USDT / USD | `USDTUSD` | **Supported** | Multi-venue Stablecoin |
| - | USDC / USD | `USDCUSD` | **Supported** | Multi-venue Stablecoin |
| - | WTHRU / USD | `WTHRUUSD` | **Supported (Pending AMM)** | ThruSwap AMM pool |

*Note on legacy slots:* Other historical slots (IDs 4–16, 18–32) remain for wire-compatibility with v1 binary decoders, but are classified as untracked under Tier T0.

---

## 4. Scope Boundaries & Disclaimers

1. **Non-Custodial CLOB:** The CLOB orderbook located in `research/clob/` is strictly a research prototype. It does not implement token custody or balance escrow.
2. **Oracle Reliability:** Current Tier T0 relies on a single publisher key and off-chain quorum. Migration to on-chain consensus (Tier T1/T2) is underway in Phase 2.
3. **No Unsubstantiated Claims:** In compliance with repository policy, no production, institutional, or audited guarantees are made prior to Tier T3.
