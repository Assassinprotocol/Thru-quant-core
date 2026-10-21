# Thru Price Hub

[![CI](https://github.com/Assassinprotocol/Thru-quant-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Assassinprotocol/Thru-quant-core/actions/workflows/ci.yml)
![Target ISA](https://img.shields.io/badge/ISA-RISC--V%20RV64IMC-blue?style=flat-square)
![Network](https://img.shields.io/badge/Network-Thru%20Betanet-black?style=flat-square)
![Trust Tier](https://img.shields.io/badge/Tier-T0%20(Single--Publisher)-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

Deterministic Q64.64 fixed-point market data oracle and risk primitives in C for Thru Network (RISC-V RV64IMC), with multi-venue Go feeder and TypeScript SDK.

---

## 1. Overview & Trust Tier

`thru-price-hub` delivers verified on-chain pricing and risk metrics for DeFi builders on Thru Network:

- **Tier Status:** `Tier T0 (Experimental, Single-Publisher)`. Current deployment targets **Thru Betanet** (`https://rpc.betanet.thru.org`, Chain ID 2).
- **Core Primitives:**
  1. **Q64.64 Math Core:** 128-bit signed fixed-point arithmetic (`src/thru_math.c`) running on 64-bit ALU registers with checked bounds and Newton-Raphson square roots.
  2. **Market Oracle Contract:** Packed 948-byte storage account (`src/market_oracle.c`) tracking real-time asset quotes, authority checks, and block-time freshness.
  3. **Multi-Venue Ingestion:** Go feeder (`feeder/quorum/`) aggregating quotes from Binance, Coinbase, OKX, and Kraken with outlier rejection.
  4. **Integration Layer:** Zero-dependency TypeScript SDK (`sdk/`) and REST/SSE API daemon (`api/`).

### Explicit Scope Boundaries
- **Asset Universe:** Focused strictly on **Core-6** (`BTC/USD`, `ETH/USD`, `SOL/USD`, `USDT/USD`, `USDC/USD`, `WTHRU/USD`). See [docs/facts/asset-demand.md](docs/facts/asset-demand.md).
- **CLOB Matching Engine:** Quarantined as a research prototype under [research/clob/](research/clob/). It models price-time priority matching in memory with **zero token custody or balance escrow**.
- **Historical Alphanet Evidence:** Slot 7,743,340 on-chain evidence is archived as frozen SHA-256 test fixtures following the Alphanet chain reset. See [docs/facts/thru-facts.md](docs/facts/thru-facts.md).

---

## 2. 10-Minute Betanet Quickstart

### Read On-Chain Oracle State (TypeScript)

```typescript
import { OracleClient } from "@thru-quant/core-sdk";

const client = new OracleClient({
  rpcUrl: "https://rpc.betanet.thru.org",
  programId: "taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR",
  storageAccount: "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN",
});

const state = await client.getLatestState();
const btc = state.bySymbol["BTCUSDT"];
console.log(`BTC: $${btc.priceDecimal} | Age: ${state.ageSeconds}s | Breaker: ${state.circuitBreakerActive}`);
```

### Local Build & Verification

```bash
# 1. Run all unit tests with ASan & UBSan
make test

# 2. Run golden math vector tests & coverage gate (>= 85%)
make test-math-golden coverage

# 3. Compile RISC-V RV64IMC binary (< 32 KB target)
make build-rv64
```

---

## 3. Trust Tiers & Verification Hierarchy

Claims in this repository adhere strictly to the **Trust Ladder**:

| Tier | Designation | Consensus Model | Current Status |
|:---:|---|---|:---:|
| **T0** | Single-Operator | 1 publisher key, off-chain multi-venue median | **Active (Betanet)** |
| **T1** | Multi-Key | $\ge 3$ independent keys/hosts, on-chain median | In Development (v2) |
| **T2** | Multi-Operator | $\ge 3$ external independent publishers | Planned (v2) |
| **T3** | Production / Accountable | Slashing / bonding, third-party audit, 60-day SLO | Planned |

- Formal evidence registry: [docs/claims.md](docs/claims.md)
- Network environment facts: [docs/facts/thru-facts.md](docs/facts/thru-facts.md)
- Operational runbook: [docs/runbook.md](docs/runbook.md)
- Component status: [STATUS.md](STATUS.md)

---

## 4. License

Licensed under the MIT License. See [LICENSE](LICENSE) and [docs/facts/licensing.md](docs/facts/licensing.md).
