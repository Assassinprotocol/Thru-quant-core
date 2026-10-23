# Methodology: Derived Risk Signals

This document specifies the mathematical formulations and state machines used by the Thru Quant Core indexer (`@thru-quant/indexer`) to derive off-chain quantitative risk metrics from on-chain Oracle v2 consensus events.

All metrics are fully deterministic and reproducible from raw on-chain data.

---

## 1. Rolling Realized Volatility

### Formulation

Given an ordered sequence of canonical consensus prices $P_0, P_1, \dots, P_N$ sampled across slot intervals within a rolling window:

1. **Discrete Returns:**
   $$r_t = \frac{P_t - P_{t-1}}{P_{t-1}}, \quad t \in \{1, \dots, N\}$$

2. **Sample Mean Return:**
   $$\bar{r} = \frac{1}{N} \sum_{t=1}^N r_t$$

3. **Sample Standard Deviation:**
   $$\sigma = \sqrt{\frac{1}{N - 1} \sum_{t=1}^N (r_t - \bar{r})^2} \quad (N \ge 2)$$

4. **Basis Point Quantization:**
   $$\sigma_{\text{bps}} = \min\left(100{,}000, \, \max\left(0, \, \lfloor \sigma \times 10{,}000 \rceil\right)\right)$$

### Windows

- **30m Window:** Evaluated across the most recent 10 published rounds.
- **1h Window:** Evaluated across the most recent 20 published rounds.
- **24h Window:** Evaluated across the full active memory ring buffer (up to 500 rounds).

---

## 2. Stablecoin Depeg Index

For fiat-backed or algorithmic stablecoins pegged to USD (e.g., `USDT/USD`, `USDC/USD`):

$$\text{depeg}_{\text{bps}} = \lfloor |P - 1.00000000| \times 10{,}000 \rceil$$

Non-USD pairs yield an explicit `depeg_bps = 0`.

---

## 3. Market Regime Classifier

The indexer assigns an integer regime identifier based on volatility thresholds and on-chain dispersion flags:

| Regime ID | State | Trigger Conditions | Downstream Recommendation |
|:---:|---|---|---|
| **0** | `CALM` | $\sigma_{\text{1h}} < 150\text{ bps}$ and zero uncertainty flags | Normal margin & collateral parameters |
| **1** | `ELEVATED_VOL` | $150\text{ bps} \le \sigma_{\text{1h}} < 500\text{ bps}$ | Increase collateral buffers; tighten liquidation collars |
| **2** | `EXTREME_DISPERSION` | $\sigma_{\text{1h}} \ge 500\text{ bps}$, or `LOW_CONFIDENCE` flag, or `OUTLIER_REJECTED` flag | Asymmetric pricing bounds; pause automated borrowing |

---

## 4. Verification & Reproducibility

Every derived metric record in `derived_risk_signals` stores the block slot height at which it was evaluated. Anyone can reconstruct the exact metric series from scratch by replaying `feed_aggregates` through `evaluateRiskSignals()`.
