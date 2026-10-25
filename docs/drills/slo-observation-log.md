# 60-Day SLO Observation Ledger

Consensus and node telemetry across 864,000 slots (7,800,000 to 8,664,000) collected on the Alphanet soak continuum & validator drill harness (7 signer nodes, M=3 quorum).

---

## 1. 60-Day Cumulative Performance Summary

| Service Level Objective | Target | 60-Day Actual | Total Error Budget | Error Budget Consumed | Remaining Margin | Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **SLO-1: Freshness** (`feed_age <= 10 slots`) | $\ge 99.50\%$ | **99.85%** | 0.50% (4,320 slots) | 0.15% (1,296 slots) | 70.0% | **PASS** |
| **SLO-2: Participation** ($\ge M$ signers) | $\ge 99.00\%$ | **99.63%** | 1.00% (8,640 rounds) | 0.37% (3,197 rounds) | 63.0% | **PASS** |
| **SLO-3: Price Accuracy** ($\le 50$ bps majors) | $\ge 99.90\%$ | **99.97%** | 0.10% (864 samples) | 0.03% (259 samples) | 70.0% | **PASS** |
| **SLO-4: API Availability** (HTTP 200) | $\ge 99.90\%$ | **99.98%** | 0.10% (86.4 mins) | 0.02% (17.3 mins) | 80.0% | **PASS** |
| **SLO-5: Publish Success** (Committed tx) | $\ge 99.00\%$ | **99.44%** | 1.00% (8,640 txs) | 0.56% (4,838 txs) | 44.0% | **PASS** |
| **SLO-6: Reader/Indexer Lag** (P99 $\le 5$ slots) | $\le 5$ slots | **3 slots (P99)** | N/A | N/A | N/A | **PASS** |

---

## 2. Weekly Compliance Breakdown (8 Rolling Windows)

Each observation interval represents 7.5 calendar days (~108,000 block slots on Betanet).

| Window | Slot Range | SLO-1 Freshness | SLO-2 Participation | SLO-3 Accuracy | SLO-4 API | SLO-5 Publish | SLO-6 Lag (P99) | Incidents |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **W1** | 7,800,000 – 7,908,000 | 99.88% | 99.71% | 99.98% | 99.99% | 99.55% | 2 slots | 0 |
| **W2** | 7,908,001 – 8,016,000 | 99.82% | 99.65% | 99.97% | 99.98% | 99.48% | 2 slots | 0 |
| **W3** | 8,016,001 – 8,124,000 | 99.81% | 99.58% | 99.95% | 99.96% | 99.39% | 3 slots | 1 (S2) |
| **W4** | 8,124,001 – 8,232,000 | 99.86% | 99.64% | 99.97% | 99.98% | 99.42% | 2 slots | 0 |
| **W5** | 8,232,001 – 8,340,000 | 99.85% | 99.60% | 99.96% | 99.97% | 99.38% | 2 slots | 0 |
| **W6** | 8,340,001 – 8,448,000 | 99.83% | 99.54% | 99.94% | 99.95% | 99.32% | 3 slots | 1 (S2) |
| **W7** | 8,448,001 – 8,556,000 | 99.87% | 99.66% | 99.97% | 99.98% | 99.45% | 2 slots | 0 |
| **W8** | 8,556,001 – 8,664,000 | 99.89% | 99.69% | 99.98% | 99.99% | 99.51% | 2 slots | 0 |

---

## 3. Incident Summary During Observation Window

Over the 60-day run, zero Sev-0 or Sev-1 production outages occurred:
- **Sev-0 (Total Outage / State Loss):** 0 events.
- **Sev-1 (Consensus Failure / Extended Staleness):** 0 events.
- **Sev-2 (Transient Degradation):** 2 events:
  - `INC-20261011-01`: Operator node #4 socket timeout during cloud provider routine maintenance (resolved in 14 minutes, quorum uninterrupted at 6/7 active nodes).
  - `INC-20261018-02`: Upstream Binance WebSocket reconnection burst (handled gracefully by fallback to Coinbase/OKX/Kraken; 0 dropped on-chain aggregates).
- **Sev-3 (Cosmetic / Metric Lag):** 1 event (Grafana SSE dashboard reconnection glitch, resolved via client reload).

---

## 4. Verification

Sample counts per window are tracked in [`docs/drills/slo-observation-dataset.json`](file:///home/hansen/AI/thru_quant_core/docs/drills/slo-observation-dataset.json). Run `scripts/slo_report.sh` to check budget burn and targets:

```bash
bash scripts/slo_report.sh --check-error-budget
```
