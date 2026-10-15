# Thru Quant Core — Operator Runbook & Incident Response (v0.3.0)

This document specifies the standard operating procedures (SOPs) for maintaining, monitoring, and operating the **Thru Quant Data & Risk Engine** across live Thru networks.

---

## 1. Routine Deployment & Operation

### 1.1 Running the Oracle API Daemon & Developer Console
The API daemon decodes on-chain binary account state (`oracle_account_data_t`, 948 bytes) and serves REST/SSE endpoints along with the live web console:

```bash
# Production background execution (defaults to port 8080)
./build/thru_oracle_api \
  --port 8080 \
  --static-dir ./visualizer \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --network Alphanet
```

### 1.2 Running the Market Data Feeder
The feeder monitors local or incoming market state files, validates timestamps, computes log-return volatility, and broadcasts updates on-chain:

```bash
# Execute continuous updates with 5s interval
./build/feeder \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer 0xhansen \
  --interval 5s
```

---

## 2. Health & Readiness Monitoring

### 2.1 Liveness Probe (`GET /health`)
- **Purpose**: Verifies that the HTTP process is alive and responsive.
- **Expected Status**: `HTTP 200 OK`
- **Kubernetes / Docker Configuration**:
  ```yaml
  livenessProbe:
    httpGet:
      path: /health
      port: 8080
    initialDelaySeconds: 5
    periodSeconds: 10
  ```

### 2.2 Readiness Probe (`GET /ready`)
- **Purpose**: Verifies that on-chain data is fresh (< 120s), initialized, and no circuit breaker is tripped.
- **Expected Status**: `HTTP 200 OK` (Ready for downstream quant execution).
- **Degraded Status**: `HTTP 503 Service Unavailable`
  - Response reason `stale`: Feed age > 120s.
  - Response reason `circuit_breaker_active`: Single-slot price jump exceeded 500 bps threshold.
  - Response reason `uninitialized`: Storage account has not been initialized.
- **Kubernetes / Docker Configuration**:
  ```yaml
  readinessProbe:
    httpGet:
      path: /ready
      port: 8080
    initialDelaySeconds: 10
    periodSeconds: 5
  ```

---

## 3. Incident Management & Recovery Procedures

### 3.1 Scenario A: Stale Feed Degradation (`feed_age > 120s`)
1. **Detection**:
   - `/ready` returns HTTP 503 with `"status": "stale"`.
   - Visualizer header displays Amber badge `DEGRADED (STALE)`.
2. **Triage**:
   - Check feeder daemon logs:
     ```bash
     journalctl -u thru-feeder -n 50
     ```
   - Verify whether source market data is updating in `data/market_history.json`.
   - Verify whether RPC connection to Thru Alphanet is reachable.
3. **Mitigation**:
   - If RPC is unreachable, API automatically falls back to local snapshot mode with Amber warning.
   - Restart feeder daemon once RPC connectivity is restored:
     ```bash
     systemctl restart thru-feeder
     ```

### 3.2 Scenario B: Circuit Breaker Tripped (`circuit_breaker_active == 1`)
1. **Detection**:
   - `/ready` returns HTTP 503 with `"status": "circuit_breaker_active"`.
   - Visualizer activates prominent Crimson banner:  
     `🚨 CIRCUIT BREAKER TRIPPED: On-chain price jump exceeded volatility threshold.`
   - Contract strictly blocks all further quote updates (`ORACLE_ERR_CIRCUIT_BREAKER = 0x2007`). Existing quotes are preserved.
2. **Investigation**:
   - Read on-chain event logs to identify the offending asset and percentage deviation:
     ```bash
     curl -s http://localhost:8080/v1/oracle/latest | jq '{circuit_breaker_active, regime_id, last_update_ts}'
     ```
   - Verify if the price movement was genuine market volatility or an aberrant oracle bad-data spike.
3. **Authorized Recovery & Reset**:
   - Execute the official authorized resume protocol using the authority key:
     ```bash
     # Dry-run validation
     ./build/feeder --resume --dry-run
     
     # On-chain execution
     ./build/feeder --resume \
       --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
       --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
       --fee-payer 0xhansen
     ```
   - Read back account state to verify reset:
     ```bash
     curl -s http://localhost:8080/ready | jq .
     ```
     Status must transition back to `HTTP 200 OK` with `"circuit_breaker_active": false`.

---

## 4. Key Management & Authority Rotation

1. **Private Key Protection**:
   - Never commit or log raw private keys or seed phrases.
   - Reference keys exclusively via key name (`--fee-payer 0xhansen`) or keyfile path.
2. **Authority Verification**:
   - The on-chain oracle validates that transaction signer matches `authority_pubkey` initialized in offset 4..36 of `oracle_account_data_t`.
   - Unauthorized attempts to submit updates or trigger resumes revert with `ORACLE_ERR_UNAUTHORIZED` (`0x2003`).
