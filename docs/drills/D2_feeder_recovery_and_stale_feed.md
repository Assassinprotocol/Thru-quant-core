# Drill D2: Feeder Crash & Stale Feed Recovery

**Drill Objective:** Validate detection of stale market data ($> 120$s) via the readiness probe and verify that restarting the feeder synchronizes timestamps cleanly without triggering on-chain monotonic regression (`0x200E`).

---

### Step 1: Simulate Feeder Process Termination

Terminate the running feeder process to simulate an unhandled crash or host reboot:

```bash
pkill -9 -f "feeder"
```

Verify the process has ceased:
```bash
pgrep -f "feeder" || echo "Feeder process inactive"
```

---

### Step 2: Observe Stale Feed Degradation

Wait 120 seconds for the existing on-chain quotes to expire:

```bash
sleep 125
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
  "message": "feed is stale: feed age (125s) exceeds maximum allowed age (120s)"
}
```

*Note: The liveness probe (`GET /health`) continues to return `HTTP 200 OK`, ensuring the container orchestrator does not trigger unnecessary pod restart loops.*

---

### Step 3: Feeder Restart & Monotonic State Sync

Restart the feeder service:

```bash
./build/feeder \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer 0xhansen \
  --interval 5s
```

**Expected Startup Log:**
```text
[INFO] feeder: initializing market feeder daemon
[INFO] feeder: querying on-chain storage account for last known timestamp
[INFO] feeder: last on-chain update timestamp: 1791968301 (feed_age=127s)
[INFO] feeder: reading local quotes from data/market_history.json
[INFO] feeder: monotonic filter verified: incoming timestamp 1791968430 > last_update_ts 1791968301
[INFO] feeder: broadcast batch containing 28 assets confirmed in slot 7743450
```

---

### Step 4: Verification of Service Restoration

```bash
curl -i http://localhost:8080/ready
```

**Expected HTTP Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "ready": true,
  "status": "ready",
  "circuit_breaker_active": false,
  "entry_count": 28,
  "feed_age_sec": 3
}
```
