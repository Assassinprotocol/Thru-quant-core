# Drill D1: Circuit Breaker Trip & Rebase Procedure

**Drill Objective:** Validate that a market jump exceeding the 500 bps collar triggers the circuit breaker, causes the feeder to transition into `HOLD`, and is cleanly recovered via the authorized `--rebase` protocol.

---

### Step 1: Simulate Volatility Spike

An incoming market update contains an 8% price increase on BTCUSDT ($83,459.50 \rightarrow \$90,136.26$), exceeding the 500 bps collar.

```bash
# Feeder submits update batch with 800 bps price change
./build/feeder --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer 0xhansen
```

**Expected Log:**
```text
[WARN] market_oracle: deviation check failed for symbol 1: delta=800 bps > 500 bps
[WARN] market_oracle: circuit breaker TRIPPED (circuit_breaker_active=1)
[INFO] feeder: breaker trip detected; state transitioned from RUNNING to HOLD
```

---

### Step 2: Verify System Degradation

Check the API readiness probe:

```bash
curl -i http://localhost:8080/ready
```

**Expected HTTP Response:**
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "ready": false,
  "status": "circuit_breaker_active",
  "circuit_breaker_active": true,
  "message": "circuit breaker active: single-slot price jump exceeded 500 bps"
}
```

---

### Step 3: Operator Triage & Decision Tree

Operator inspects the price shift using dry-run mode:

```bash
./build/feeder --rebase --dry-run
```

**Expected Output:**
```text
[REBASE DRY-RUN] Inspecting proposed price baselines across 28 assets:
  Symbol 1 (BTCUSDT): current_onchain=$83459.50 proposed=$90136.26 (delta=+8.00%)
  Symbol 2 (ETHUSDT): current_onchain=$2650.00  proposed=$2652.10 (delta=+0.08%)
  ...
[DECISION] Price move confirmed legitimate via secondary exchanges.
[DECISION] Proceeding with on-chain REBASE reset (opcode 3).
```

---

### Step 4: Execute On-Chain Rebase

Operator executes the authorized rebase with the authority key:

```bash
./build/feeder --rebase \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer 0xhansen
```

**Expected Output:**
```text
[INFO] feeder: submitted REBASE transaction to network
[INFO] feeder: transaction confirmed in slot 7743410 (rc=0)
[INFO] feeder: circuit breaker flag cleared; state transitioned from HOLD to RUNNING
```

---

### Step 5: Post-Drill Verification

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
  "feed_age_sec": 2
}
```
