# Production Incident Post-Mortem Runbook & Template

**Status:** Standard Operating Procedure (SOP)  
**Authority:** `THRU_QUANT_CORE_ROADMAP.md` §12, `docs/slos-and-alerts.md`  
**Escalation Window:** Post-mortem publication mandatory within 72 hours of incident resolution for S0 and S1 events.  

---

## 1. Incident Classification Framework

| Severity | Definition | Target Time to Detect (TTD) | Target Time to Mitigate (TTM) | Post-Mortem SLA |
|---|---|:---:|:---:|:---:|
| **S0 (Critical)** | Total consensus halt, on-chain state corruption, circuit breaker trip $> 30$ slots, or unauthorized admin execution. | $< 1$ minute | $< 15$ minutes | 24–48 hours |
| **S1 (Major)** | Loss of publisher quorum ($< M$ active signers), sustained feed staleness ($> 10$ slots for $> 5$ mins), or API gateway outage. | $< 3$ minutes | $< 30$ minutes | 72 hours |
| **S2 (Minor)** | Single publisher/venue dropout, transient rate limiting degradation, or reader lag $> 5$ slots without quorum loss. | $< 10$ minutes | $< 2$ hours | Recommended |
| **S3 (Low)** | Telemetry reporting anomalies, non-critical dashboard rendering glitch, or benign logging errors. | Next business day | Next maintenance sprint | Optional |

---

## 2. Incident Response Lifecycle

```
[ DETECTION ] ───> [ TRIAGE & NOTIFY ] ───> [ CONTAINMENT ] ───> [ RESOLUTION ] ───> [ POST-MORTEM (72h) ]
  Prometheus          Ops Pager / Bridge       RPC Failover /        On-Chain Verify       Root Cause (5 Whys)
  Alert Rule          Severity Declared        Quorum Rebalance      SLO Burn Recorded     Action Items Logged
```

1. **Detection:** Automated alert fire (`OracleFeedStale`, `QuorumDegraded`, `CircuitBreakerTripped`) or anomaly detection via `/metrics`.
2. **Triage & Containment:** Declare incident severity, open response bridge, and execute immediate mitigation per `docs/runbook.md` (e.g. switch fallback RPC, activate reserve publisher).
3. **Resolution & Stabilization:** Confirm healthy slot progression, verify `api_feed_age_slots <= 10`, and validate oracle state readback.
4. **Post-Mortem & Preventative Actions:** Convene blameless retrospective, identify systemic causes via 5 Whys, assign owners, and track remediation patches.

---

## 3. Incident Post-Mortem Template

```markdown
# Incident Post-Mortem: [INC-YYYYMMDD-XX - Brief Title]

## Executive Summary
- **Incident ID:** INC-YYYYMMDD-XX
- **Severity Level:** S0 / S1 / S2 / S3
- **Incident Date:** YYYY-MM-DD
- **Incident Start (UTC):** YYYY-MM-DD HH:MM:SS
- **Mitigation Completed (UTC):** YYYY-MM-DD HH:MM:SS
- **Total Duration:** X hours Y minutes
- **Lead Responder:** [Name / Role]
- **Participating Engineers:** [Names / Roles]

## Impact Assessment
- **Affected Subsystems:** [On-chain Oracle / Feeder / API Gateway / Indexer]
- **Affected Feed Symbols:** [Core-6 / Subset / None]
- **SLO Error Budget Impact:**
  - SLO-1 (Freshness): X% burned (Y slots delayed)
  - SLO-2 (Participation): X% burned (Y aggregation rounds degraded)
  - SLO-3 (Accuracy): Max deviation Z bps observed
  - SLO-4 (API Availability): X minutes non-200 responses
  - SLO-5 (Publish Success): X rejected transactions

## Timeline of Events (UTC)
| Timestamp | Event Description | Detected / Logged By |
|---|---|---|
| HH:MM:SS | Root anomaly introduced / external dependency failure. | Upstream provider |
| HH:MM:SS | Alert triggered in Alertmanager (`[AlertName]`). | Prometheus |
| HH:MM:SS | Incident declared; severity set to SX; bridge opened. | On-Call Lead |
| HH:MM:SS | Containment action executed: [Action details]. | Operator |
| HH:MM:SS | Normal consensus verified on-chain (Slot N). | Thru CLI / Node |
| HH:MM:SS | All alerts cleared; incident downgraded to monitoring. | Bridge Lead |

## Root Cause Analysis (Blameless 5 Whys)
1. **Why did the failure manifest?**
   -> [Direct symptom]
2. **Why did [Direct symptom] occur?**
   -> [Immediate cause]
3. **Why did [Immediate cause] happen without prevention?**
   -> [Systemic / environmental trigger]
4. **Why was the trigger not identified earlier?**
   -> [Monitoring / test suite gap]
5. **Why was the design susceptible to this failure mode?**
   -> [Architectural / invariant root cause]

## What Went Well & What Went Wrong
### What Went Well
- Monitoring alerted within target TTD.
- Secondary publishers maintained quorum consensus without data corruption.
- Runbook steps provided clear remediation paths.

### Where We Got Lucky
- Anomaly occurred outside peak trading volume hours.

### What Needs Improvement
- Manual intervention was required where automated failover was intended.
- Logging lacked contextual transaction error codes on initial rejection.

## Preventative Action Items
| Action Item | Type | Owner | Tracking Issue | Due Date |
|---|:---:|:---:|:---:|:---:|
| Add regression test in `tests/` | Prevent | [Name] | #XX | YYYY-MM-DD |
| Tune alert threshold in `prometheus/alerts.yml` | Detect | [Name] | #XX | YYYY-MM-DD |
| Update runbook documentation | Mitigate | [Name] | #XX | YYYY-MM-DD |
```
