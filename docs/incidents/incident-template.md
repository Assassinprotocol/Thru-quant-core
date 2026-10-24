# Incident Post-Mortem Template

Post-mortem report template for P0 and P1 operational incidents. Required within 72 hours of incident resolution.

---

## 1. Incident Overview

| Field | Detail |
|---|---|
| **Incident ID** | `INC-YYYYMMDD-XX` |
| **Date & Time (UTC)** | YYYY-MM-DD HH:MM:SS UTC |
| **Duration** | X hours Y minutes |
| **Severity Level** | **P0 (Emergency)** / **P1 (High)** / **P2 (Warning)** |
| **Lead Responder** | [Operator / Engineer Name] |
| **Status** | Resolved / Monitoring |

### Impact Summary
- **Affected Services:** [Market Oracle On-Chain, API Daemon, Feeder Quorum]
- **Affected Asset Pairs:** [BTCUSDT, ETHUSDT, SOLUSDT, or All Feeds]
- **SLO Error Budget Burn:**
  - SLO-1 (Freshness $\le$ 10 slots): X minutes degraded (Y% of 30-day budget)
  - SLO-3 (Accuracy vs reference): Max deviation observed (Z bps)

---

## 2. Incident Timeline (UTC)

| Time (UTC) | Event | Detected By |
|---|---|---|
| `HH:MM:SS` | Trigger condition occurred on-chain or upstream | Exchange API / Validator |
| `HH:MM:SS` | Alert fired (`OracleFeedSlotLagElevated` or `OracleCircuitBreakerTripped`) | Prometheus / Alertmanager |
| `HH:MM:SS` | On-call engineer acknowledged alert; triage bridge established | Ops Pager |
| `HH:MM:SS` | Mitigation action initiated (e.g. RPC failover / rebase tx) | Operator |
| `HH:MM:SS` | State verified normal on-chain (Slot N verified) | Thru CLI / Explorer |
| `HH:MM:SS` | Incident resolved; post-resolution monitoring started | Incident Lead |

---

## 3. Root Cause Analysis (5 Whys)

1. **Why did the incident occur?**
   - [Direct cause]
2. **Why did [Direct cause] happen?**
   - [Underlying cause]
3. **Why did [Underlying cause] occur?**
   - [Systemic condition]
4. **Why was the condition not caught before production?**
   - [Test / verification gap]
5. **Why did automated controls not mitigate it?**
   - [Fail-safe / circuit breaker behavior]

---

## 4. Trigger & Technical Details

- **Trigger Event:** [Description of input, network condition, or software defect]
- **Evidence Hashes:**
  - Transaction Signatures: `[tx-signature-or-hash]`
  - On-Chain Slot Range: `[Slot Start] - [Slot End]`
  - Program / State Account: `taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN`

---

## 5. Corrective & Preventative Action Items

| ID | Action Item | Scope | Assignee | Target Date | Tracking PR / Issue |
|---|---|---|---|---|---|
| ACT-01 | [Add RPC retry backoff policy] | Resilience | [Name] | YYYY-MM-DD | `#PR` |
| ACT-02 | [Update quorum outlier threshold] | Feed Quality | [Name] | YYYY-MM-DD | `#PR` |
| ACT-03 | [Add regression test case to CI] | Regression | [Name] | YYYY-MM-DD | `#PR` |

---

## 6. Lessons Learned

### What went well
- [Circuit breaker halted invalid updates immediately, preventing bad state propagation]
- [Alertmanager notified on-call within 15 seconds]

### What went wrong
- [Lack of automated RPC fallback caused delay in manual operator triage]

### Where were we lucky
- [Incident occurred during active Asian trading hours when engineer was online]
