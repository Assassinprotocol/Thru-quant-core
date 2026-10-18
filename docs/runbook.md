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
   - Visualizer activates red banner:  
     `CIRCUIT BREAKER TRIPPED: On-chain price jump exceeded volatility threshold.`
   - Contract strictly blocks all further quote updates (`ORACLE_ERR_CIRCUIT_BREAKER = 0x2007`). Existing quotes are preserved.
2. **Investigation**:
   - Inspect on-chain state to identify offending assets and percentage deviation:
     ```bash
     curl -s http://localhost:8080/v1/oracle/latest | jq '{circuit_breaker_active, regime_id, last_update_ts}'
     ```
   - Compare current market spot prices against the last committed on-chain quotes.

3. **Break-Glass Decision Tree: `RESUME` vs `REBASE`**:

   ```
                      [ Circuit Breaker Tripped ]
                                   │
                   Is market price within ±500 bps
                      of last on-chain quote?
                                  / \
                                 /   \
                             YES       NO
                              /         \
                             ▼           ▼
                      [ Anomaly Transien ]   [ Structural Shift (≥5%) ]
                             │                         │
                  Run --resume protocol        Run --rebase protocol
               (Unpauses; next tick checks)   (Atomic baseline reset)
   ```

   - **Path A: Transient Spike Reversion (`RESUME`)**
     - *Condition:* Offending market spike has reverted to within ±5% of the pre-trip baseline.
     - *Procedure:*
       ```bash
       # 1. Dry-run verification
       ./build/feeder --resume --dry-run

       # 2. On-chain execution via authority key
       ./build/feeder --resume \
         --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
         --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
         --fee-payer 0xhansen
       ```

   - **Path B: Permanent Structural Move (`REBASE`)**
     - *Condition:* Real-world market price moved $\ge 5\%$ (e.g. macro volatility, ETF approval).
     - *Danger:* Calling `--resume` under a structural shift will cause the very next update batch to re-trip the breaker (`0x2007`), trapping the feed in an infinite trip loop.
     - *Procedure:*
       ```bash
       # 1. Dry-run inspection: review new baselines across all assets
       ./build/feeder --rebase --dry-run

       # 2. On-chain execution: atomically writes fresh prices and clears breaker
       ./build/feeder --rebase \
         --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
         --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
         --fee-payer 0xhansen
       ```

4. **Post-Recovery Verification**:
   - Read back readiness endpoint:
     ```bash
     curl -s http://localhost:8080/ready | jq .
     ```
     Status must transition back to `HTTP 200 OK` with `"circuit_breaker_active": false`.

---

## 4. Key Management & Cold/Hot Role Separation

### 4.1 Key Architecture

| Role | Instruction Scope | Environment | Security Requirement |
| :--- | :--- | :--- | :--- |
| **Hot Feeder Key** | Opcode `1` (`UPDATE_PRICES`) | Feeder Daemon Host | Filesystem permissions `chmod 600`, non-root execution, automated signing. |
| **Cold Admin Key** | Opcode `0` (`INITIALIZE`)<br>Opcode `2` (`RESUME`)<br>Opcode `3` (`REBASE`) | Air-gapped / Operator Workstation | Isolated from public networks, manual passphrase entry, hardware-backed storage where available. |

### 4.2 Key Generation & Storage Procedures

1. **Key Generation**:
   ```bash
   # Generate dedicated operational keypair
   thru keys generate --name oracle-feeder-hot
   thru keys generate --name oracle-admin-cold
   ```

2. **Zero Plaintext Key Exposure**:
   - Never print, log, or pipe private keys or seed phrases to stdout or shell history.
   - Always reference keys by their handle (e.g. `--fee-payer 0xhansen`) or via encrypted keyfile path.
   - The on-chain oracle program strictly rejects instructions where signer does not match `authority_pubkey` with `ORACLE_ERR_UNAUTHORIZED` (`0x2003`).

3. **Key Rotation**:
   - When rotating hot keys, update the feeder systemd service file and restart:
     ```bash
     systemctl restart thru-feeder
     ```
   - In v1, the contract's `authority_pubkey` is set during initialization (`handle_initialize`). Upgrading authority requires deploying a new storage account or using the v2 multisig aggregator contract.
