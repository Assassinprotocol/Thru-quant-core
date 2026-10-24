# Production SLOs, SLIs, and Alert Thresholds

On-chain slot-based SLOs, SLIs, and operational alert thresholds for the Thru Market Oracle and Feeder subsystem on Betanet.

SLIs are measured against on-chain block slots instead of host wall-clock time.

---

## 1. On-Chain Slot-Based SLOs (Roadmap §12)

| Objective | Target | Measurement Window | SLI Definition (Slot-Based) | Error Budget |
| :--- | :---: | :---: | :--- | :--- |
| **SLO-1: Freshness** | **99.5%** | Rolling 30 days | Ratio of on-chain slots where `api_feed_age_slots <= 10` (approx 10s on Betanet) over total elapsed network slots. | 0.5% (approx. 43,200 slots / month) |
| **SLO-2: Participation** | **99.0%** | Rolling 14 days | Ratio of aggregation rounds containing $\ge M$ valid submissions. (In Tier T0: single-publisher quorum validation). | 1.0% |
| **SLO-3: Accuracy vs Reference** | **99.9%** | Rolling 30 days | Ratio of oracle price samples with absolute deviation $\le 50$ bps (majors) and $\le 20$ bps (stablecoins) relative to independent exchange composite. | 0.1% |
| **SLO-4: API Availability** | **99.9%** | Rolling 30 days | Ratio of successful HTTP 200 responses on `/v1/status` and `/v1/oracle/latest` divided by total non-client error requests. | 0.1% (approx. 43 minutes / month) |
| **SLO-5: Publish Success** | **99.0%** | Rolling 7 days | Ratio of successfully committed on-chain transactions to attempted publisher transactions (excluding intentional circuit breaker trips). | 1.0% |
| **SLO-6: Reader Lag** | **p99 $\le$ 5 slots** | Rolling 7 days | On-chain slot difference between latest finalized block and reader account cache: `network_slot - oracle_slot <= 5`. | 1% of samples $> 5$ slots |

---

## 2. Severity Classification & Incident Response

### Severity P0: Emergency
- **Criteria:**
  - Circuit breaker active on-chain (`api_circuit_breaker_active == 1`).
  - Feed age exceeds fail-closed limit (`api_feed_age_slots > 120` for $> 30$ slots).
  - All feeder venue sources fail quorum for more than 3 consecutive update cycles.
- **Response Protocol:**
  - Notification: Automated pager + on-call bridge.
  - Escalation SLA: Immediate ack within 5 minutes.
  - Action: Execute triage per `docs/runbook.md` (Decision Tree: `RESUME` vs `REBASE`).
  - Post-mortem required within 72 hours via `docs/runbooks/post-mortem-template.md`.

### Severity P1: High Severity
- **Criteria:**
  - Error budget burn rate $> 1\%$ over a 15-minute rolling window (`FeederPublishFailureBudget`).
  - Tracked assets degraded below minimum threshold (`api_tracked_assets < 3`).
  - Sustained transaction rejection without circuit breaker trip (e.g. balance exhaustion).
- **Response Protocol:**
  - Notification: Ops Slack / Telegram alerts.
  - Escalation SLA: Response within 15 minutes.
  - Action: Verify RPC connectivity, fee-payer balance, and block production.

### Severity P2: Warning
- **Criteria:**
  - Feed age exceeds 10 slots for $> 1$ minute (`OracleFeedSlotLagElevated`).
  - Individual venue outlier detected in quorum aggregation.
  - SSE subscriber pool reaches $> 80\%$ capacity (205 / 256 clients).
- **Response Protocol:**
  - Notification: Internal observability feed / webhook.
  - Escalation SLA: Acknowledged within 2 hours.
  - Action: Monitor exchange upstream API rate limits and connection hygiene.

---

## 3. Metrics Reference & Prometheus Mapping

Metrics exposed on daemon `/metrics` endpoint:

| Prometheus Metric | Type | Description |
| :--- | :---: | :--- |
| `api_circuit_breaker_active` | Gauge | `1` if on-chain breaker is active (halts writes); `0` if normal. |
| `api_oracle_slot` | Gauge | On-chain slot height recorded in current oracle state. |
| `api_feed_age_slots` | Gauge | Current feed age measured in slot units (average 1 slot/sec). |
| `api_feed_age_seconds` | Gauge | Seconds elapsed since last confirmed on-chain batch update. |
| `api_tracked_assets` | Gauge | Total actively quoted assets in oracle storage. |
| `api_oracle_updates_total` | Counter | Total valid on-chain oracle batches ingested. |
| `api_circuit_breaker_trips_total` | Counter | Cumulative counter of breaker trip events observed. |
| `api_rpc_failures_total` | Counter | Cumulative failed JSON-RPC queries to the Thru validator node. |
| `api_requests_total` | Counter | Total HTTP requests processed across all daemon endpoints. |
| `api_stream_clients_active` | Gauge | Active concurrent SSE connections. |

Prometheus alert rules defined in [`prometheus/alerts.yml`](../prometheus/alerts.yml).

---

## 4. Runbook & Incident References
- Operator recovery decision tree: [`docs/runbook.md`](runbook.md)
- Incident post-mortem template: [`docs/runbooks/post-mortem-template.md`](runbooks/post-mortem-template.md)
- Reverse proxy and security deployment: [`docs/reverse-proxy.md`](reverse-proxy.md)
- Threat model and invariant mappings: [`docs/threat-model.md`](threat-model.md)
