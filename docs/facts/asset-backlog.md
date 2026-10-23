# Asset Feed Expansion Backlog

This document maintains the canonical ledger of requested market data feeds beyond the active **Core-6** universe on Thru Betanet.

---

## 1. Onboarding Criteria

Feeds are admitted to the active consensus registry only upon satisfying the following liquidity and venue requirements:

1. **Independent Venue Quorum:** Minimum 3 independent spot venues (e.g. Binance, OKX, Coinbase, Kraken, or verified on-chain pool TWAP) with continuous order book liquidity.
2. **24-Hour Depth Threshold:** Aggregate daily volume across qualifying venues must exceed $\$1,000,000\text{ USD}$ with median 2% depth $\ge \$50,000$.
3. **Spread Stability:** Baseline median bid-ask spread $\le 20\text{ bps}$ during normal market regimes.
4. **Written Protocol Sponsor:** At least one live or staging dApp on Thru Network with documented smart contract dependencies requiring the feed.

---

## 2. Active Universe (Core-6)

| Symbol | Target Pair | Precision | Base Asset | Status | Quorum Venues |
|---|---|---|---|---|---|
| `BTC` | `BTC/USD` | Q64.64 | Bitcoin | **ACTIVE** | Binance, Coinbase, OKX, Kraken |
| `ETH` | `ETH/USD` | Q64.64 | Ethereum | **ACTIVE** | Binance, Coinbase, OKX, Kraken |
| `SOL` | `SOL/USD` | Q64.64 | Solana | **ACTIVE** | Binance, Coinbase, OKX, Kraken |
| `USDT` | `USDT/USD` | Q64.64 | Tether | **ACTIVE** | Binance, Kraken, OKX |
| `USDC` | `USDC/USD` | Q64.64 | USD Coin | **ACTIVE** | Coinbase, Kraken, OKX |
| `WTHRU` | `WTHRU/USD` | Q64.64 | Wrapped Thru | **ACTIVE** | Thru DEX Pool, Betanet Feeder |

---

## 3. Candidate Feed Backlog

| Priority | Asset Symbol | Requesting Protocol | Target Launch | Liquidity Status | Stage |
|:---:|---|---|:---:|---|:---:|
| 1 | `TIA/USD` | Perpetual DEX Partner A | Betanet v2 | Verified $> \$5\text{M}$ 24h | `QUORUM_TESTING` |
| 2 | `SUI/USD` | Money Market Partner B | Betanet v2 | Verified $> \$10\text{M}$ 24h | `QUORUM_TESTING` |
| 3 | `AVAX/USD` | Liquidator Engine C | Betanet v2 | Verified $> \$8\text{M}$ 24h | `LIQUIDITY_AUDIT` |
| 4 | `NEAR/USD` | Cross-chain AMM | Future Tier T2 | Under Review | `INTAKE` |
| 5 | `ARB/USD` | Derivative Vault | Future Tier T2 | Under Review | `INTAKE` |

---

## 4. Feed Request Submission Template

Protocol teams requesting new feeds should open a GitHub Issue using this format:

```markdown
### Feed Request: [SYMBOL/USD]
1. Target Protocol: [Protocol Name & GitHub/Docs URL]
2. Use Case: [Lending Collateral / Perp Mark Price / Vault Settlement]
3. Required Venues: [List of at least 3 spot exchanges]
4. Staleness Tolerance: [e.g. Max 30 seconds]
5. Max Confidence Width: [e.g. 50 bps]
6. Contact & Staging Address: [Operator Key / Contract Address]
```
