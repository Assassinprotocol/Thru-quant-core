# Production SLOs, SLIs, and Alerting Specification

This document establishes the official Service Level Objectives (SLOs), Service Level Indicators (SLIs), and operational alerting thresholds for the Thru Market Oracle and Feeder subsystem.

---

## 1. Service Level Objectives (SLOs)

| Objective | Target | Measurement Window | SLI Definition | Error Budget |
| :--- | :---: | :---: | :--- | :--- |
| **Feed Freshness** | **99.5%** | Rolling 30 days | Ratio of seconds where `api_feed_age_seconds <= 30` over total runtime seconds. | 0.5% (approx. 3.6 hours / month) |
| **Fail-Closed Ceiling** | **99.99%** | Rolling 30 days | Ratio of seconds where `api_feed_age_seconds <= 120` over total runtime seconds. | 0.01% (approx. 4.3 minutes / month) |
| **API Availability** | **99.9%** | Rolling 30 days | Successful HTTP 200/204 responses on `/status` and `/oracle/latest` divided by total non-client error requests. | 0.1% (approx. 43 minutes / month) |
| **Publish Success** | **99.0%** | Rolling 7 days | Ratio of successfully confirmed on-chain batches to attempted publisher transactions (excluding intentional circuit breaker trips). | 1.0% |

---

## 2. Severity Classification & Incident Response

### Severity P0: Emergency (Immediate Engagement)
- **Criteria:**
  - Circuit breaker trips on-chain (`api_circuit_breaker_active == 1`).
  - Feed age exceeds fail-closed limit (`api_feed_age_seconds > 120` for $> 30$ seconds).
  - All feeder venue sources fail quorum for more than 3 consecutive updates.
- **Response Protocol:**
  - Notification channel: Automated pager + Ops on-call bridge.
  - Escalation SLA: Immediate ack within 5 minutes.
  - Action: Execute incident triage per `docs/runbook.md` (Decision Tree: `RESUME` vs `REBASE`).

### Severity P1: High Severity (Urgent)
- **Criteria:**
  - Error budget burn rate $> 1\%$ over a 15-minute rolling window.
  - Publisher experiencing sustained transaction rejection without circuit breaker trip (e.g. nonce or balance exhaustion).
- **Response Protocol:**
  - Notification channel: Ops Slack / Telegram alerts.
  - Escalation SLA: Response within 15 minutes.
  - Action: Verify RPC connectivity, fee-payer account balance, and network block production.

### Severity P2: Warning (Working Hours)
- **Criteria:**
  - Feed age exceeds 30 seconds for $> 1$ minute.
  - Individual venue outlier detected in quorum aggregation (e.g. Binance or OKX isolated).
  - SSE subscriber pool reaches $> 80\%$ capacity (205 / 256 clients).
- **Response Protocol:**
  - Notification channel: Internal observability feed.
  - Escalation SLA: Acknowledged within 2 hours.
  - Action: Monitor exchange upstream API rate limits and client connection hygiene.

---

## 3. Metrics Reference & Prometheus Mapping

The following metrics are exposed on the HTTP daemon's `/metrics` endpoint:

| Prometheus Metric | Type | Description |
| :--- | :---: | :--- |
| `api_circuit_breaker_active` | Gauge | `1` if on-chain breaker is active (halts writes); `0` if normal. |
| `api_feed_age_seconds` | Gauge | Seconds elapsed since the last confirmed on-chain batch update. |
| `api_oracle_updates_total` | Counter | Total number of valid on-chain oracle batches ingested. |
| `api_circuit_breaker_trips_total` | Counter | Cumulative counter of breaker trip events observed. |
| `api_rpc_failures_total` | Counter | Cumulative failed JSON-RPC queries to the Thru validator node. |
| `api_requests_total` | Counter | Total HTTP requests processed across all daemon endpoints. |
| `api_stream_clients_active` | Gauge | Number of active concurrent Server-Sent Events (SSE) connections. |

The formal Prometheus alert rules are defined in [`prometheus/alerts.yml`](../prometheus/alerts.yml).

---

## 4. Runbook References
- Break-glass operator recovery decision tree: [`docs/runbook.md`](runbook.md)
- Threat model and invariant mappings: [`docs/threat-model.md`](threat-model.md)
- Alphanet on-chain claims verification: [`docs/claims.md`](claims.md)
