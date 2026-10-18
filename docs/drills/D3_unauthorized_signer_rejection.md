# Drill D3: Unauthorized Signer Rejection

**Drill Objective:** Validate that on-chain permissioning strictly blocks unauthorized accounts from publishing price updates, unpausing the circuit breaker, or executing a rebase, reverting with error `0x2003` (`ORACLE_ERR_UNAUTHORIZED`).

---

### Step 1: Generate Unauthorized Keypair

Generate an unprivileged ephemeral keypair to act as an attacker:

```bash
thru keys generate --name rogue-attacker
```

---

### Step 2: Attempt Unauthorized State Modification

Attempt to execute an administrative `RESUME` instruction using the unauthorized key:

```bash
./build/feeder --resume \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer rogue-attacker
```

**Expected Error Log:**
```text
[ERROR] thru: transaction execution failed: program reverted
[ERROR] thru: exit code 0x2003 (ORACLE_ERR_UNAUTHORIZED)
[ERROR] thru: signer 38a1...f9e2 does not match contract authority_pubkey 2162...626d
```

---

### Step 3: Attempt Unauthorized Quote Injection

Attempt to submit price updates signed by the rogue key:

```bash
./build/feeder \
  --program taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR \
  --account taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN \
  --fee-payer rogue-attacker \
  --interval 5s
```

**Expected Error Log:**
```text
[ERROR] feeder: broadcast failed with on-chain revert: 0x2003 (ORACLE_ERR_UNAUTHORIZED)
[WARN] feeder: signer unauthorized; dropping uncommitted batch
```

---

### Step 4: Verify Storage Invariant Parity

Verify that the storage account was not modified:

```bash
curl -s http://localhost:8080/v1/oracle/latest | jq '{version, authority_pubkey, last_update_ts}'
```

**Expected Response:**
```json
{
  "version": 1,
  "authority_pubkey": "2162fc8aba3526df2c3428561a0ba90b9b73a9ec337e37d2ce9da97a0096626d",
  "last_update_ts": 1791968301
}
```

*The authority public key and account state remain intact. The unauthorized attempts produced zero state mutation on-chain.*
