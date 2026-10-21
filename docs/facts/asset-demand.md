# Thru Price Hub — Asset Demand Discovery & Feed Universe

**Status:** Canonical Strategy  
**Effective Date:** 2026-10-21  
**Goal:** Align published feeds with actual on-chain demand in Thru Betanet  

---

## 1. Context & Lessons from v1

In Version 1, `thru-quant-core` configured a fixed 32-asset universe consisting largely of CEX USDT pairs (e.g., BCH, KAS, BONK, PEPE). While technically functional, this structure presented major inefficiencies:
- **Zero On-Chain Utility:** Neither BCH nor KAS exist as native or bridged tokens on Thru Betanet today. No smart contract could consume them.
- **Gas & Compute Waste:** Streaming 28–32 dead feeds every block consumes unnecessary network bandwidth, state storage, and compute units.
- **Missing Ecosystem Anchor:** The native ecosystem token (**THRU / WTHRU**) was completely absent from the oracle registry.

---

## 2. Canonical Core-6 Universe

To maximize capital efficiency and security, the oracle universe is focused on **Core-6**:

| Asset Pair | Role & Rationale | Ingestion Source | Deviation Ceiling |
|---|---|---|:---:|
| **BTC / USD** | Global macro collateral anchor; lowest volatility ceiling | Binance, Coinbase, OKX, Kraken | 100 bps |
| **ETH / USD** | Primary smart contract benchmark asset | Binance, Coinbase, OKX, Kraken | 100 bps |
| **SOL / USD** | High-beta high-throughput collateral pair | Binance, Coinbase, OKX, Kraken | 150 bps |
| **USDT / USD** | Primary liquidity quote currency; depeg alarm | Binance, Kraken, Curve pools | 30 bps |
| **USDC / USD** | Secondary major stablecoin; depeg alarm | Coinbase, Kraken, Curve pools | 30 bps |
| **WTHRU / USD** | **Thru Native Asset**; pricing foundation for ecosystem DeFi | On-chain AMM pools (ThruSwap) / CEX | 300 bps |

*Note on WTHRU:* Until on-chain AMM liquidity reaches statistical significance on Betanet, Core-5 will run actively, with WTHRU joining as soon as the ThruSwap pair pool is funded.

---

## 3. Feed Expansion Policy

New price feeds will NOT be added speculatively. An asset will only be onboarded to the on-chain registry if:
1. An on-chain application (Lending protocol, CDO, AMM, or Perp DEX) submits a formal integration request.
2. The asset possesses verified spot liquidity across at least 3 independent venues.
3. The on-chain governance multisig (v2) ratifies the feed parameter configuration via timelock.
