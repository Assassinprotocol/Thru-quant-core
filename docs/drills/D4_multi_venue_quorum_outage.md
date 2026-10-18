# Drill D4: Multi-Venue Quorum Outage & Split-Brain Triage

**Drill Objective:** Validate system behavior and operator triage procedures during upstream venue network degradation, cross-exchange divergence ($> 150$ bps), and total quorum collapse ($< 2$ venues online), confirming fail-closed invariants and monotonic state recovery.

---

### Step 1: Scenario Overview & Invariant Rules

The feeder ingestion pipeline aggregates live orderbook quotes across three independent spot venues:
1. **Binance** (`wss://stream.binance.com:9443`)
2. **OKX** (`wss://ws.okx.com:8443`)
3. **Coinbase** (`wss://ws-feed.exchange.coinbase.com`)

The median quorum engine applies strict invariant gates:
- **3 Venues Online:** Calculates median price. Discards any single outlier deviating $> 150$ bps from the other two venues.
- **2 Venues Online (`FeederQuorumDegraded`):** Calculates midpoint average if divergence $\le 150$ bps. If divergence $> 150$ bps (`FeederQuorumSplitBrain`), the quote is discarded (`status=DISAGREEMENT`).
- **$< 2$ Venues Online (`StatusInsufficientVenues`):** The feeder halts on-chain submissions. After 120 seconds, the on-chain oracle expires into a fail-closed state, causing `/ready` to return HTTP 503 (`stale`).

---

### Step 2: Simulate Venue Outage & Degraded Quorum

Simulate an upstream outage on one venue (e.g., Binance WebSocket termination or IP block):

```bash
# Inject DNS failure or iptables drop for Binance WebSocket endpoint
sudo iptables -A OUTPUT -p tcp -d stream.binance.com --dport 9443 -j DROP
```

Observe feeder telemetry logs:
```
feeder: venue Binance connection dropped, retrying in backoff
feeder: quorum status degraded for BTCUSDT (2/3 venues active: OKX, Coinbase)
```

**Prometheus Alert Verification:**
Query Prometheus alerts:
```bash
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="FeederQuorumDegraded")'
```
*Expected Alert State: `firing` (severity: `warning`).*

At this stage, 2 of 3 venues remain synchronized; on-chain updates continue normally without service interruption.

---

### Step 3: Simulate Cross-Exchange Split-Brain Divergence

Simulate exchange price decoupling where OKX reports $80,000 and Coinbase reports $82,000 (divergence $= 250$ bps $> 150$ bps):

Observe feeder stderr logs:
```
feeder: quorum dropped symbol BTCUSDT: status=DISAGREEMENT max_dev=250bps
```

**Prometheus Alert Verification:**
```bash
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="FeederQuorumSplitBrain")'
```
*Expected Alert State: `firing` (severity: `critical`).*

Because disagreement prevents trusted consensus, the feeder drops the conflicting quote batch rather than publishing corrupted data to ThruVM.

---

### Step 4: Total Quorum Collapse & Fail-Closed Invariant

Simulate failure of the remaining venues (OKX and Coinbase):

```bash
sudo iptables -A OUTPUT -p tcp -d ws.okx.com --dport 8443 -j DROP
sudo iptables -A OUTPUT -p tcp -d ws-feed.exchange.coinbase.com --dport 443 -j DROP
```

Observe feeder output:
```
feeder: insufficient quorum venues (0/3 active) - halting on-chain quote publication
```

Wait 125 seconds for on-chain quotes to age out ($> 120$s):

```bash
curl -i http://localhost:8080/ready
```

**Expected HTTP Response:**
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "ready": false,
  "status": "stale",
  "circuit_breaker_active": false,
  "feed_age_sec": 125,
  "source": "ON_CHAIN",
  "slot": 7743520,
  "tracked_assets": 28
}
```

Verify semantic warnings on the status endpoint:
```bash
curl -s http://localhost:8080/v1/status | jq '.integrity_warnings'
```

**Expected JSON Output:**
```json
[
  "FEED_STALE_EXCEEDED_FAIL_CLOSED_BOUNDARY"
]
```

---

### Step 5: Operator Recovery & Monotonic Re-synchronization

1. Remove simulated network blocks:
```bash
sudo iptables -D OUTPUT -p tcp -d stream.binance.com --dport 9443 -j DROP
sudo iptables -D OUTPUT -p tcp -d ws.okx.com --dport 8443 -j DROP
sudo iptables -D OUTPUT -p tcp -d ws-feed.exchange.coinbase.com --dport 443 -j DROP
```

2. Confirm venue re-connection in feeder logs:
```
feeder: connected to Binance, OKX, Coinbase WebSocket feeds
feeder: quorum restored (3/3 venues active)
feeder: published 28 quotes at timestamp 1791880200 (slot 7743550)
```

3. Verify readiness probe returns healthy:
```bash
curl -i http://localhost:8080/ready
```
*Expected HTTP Response: `HTTP/1.1 200 OK`, `ready: true`, `status: "ready"`.*

4. Verify that the on-chain contract accepted the update without timestamp regression (`0x200E`).
