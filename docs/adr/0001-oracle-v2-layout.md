# ADR 0001: Oracle V2 Account Layout & Role Separation

- **Status:** Superseded by ADR 0003
- **Date:** 2026-10-19
- **Deciders:** Hansen Core Engineering
- **Technical Domains:** On-Chain Program, Access Control, Key Governance

---

## 1. Context & Problem Statement

In Market Oracle Account Layout Version 1 (`oracle_account_data_t`), access control is governed by a single authority public key (`authority_pubkey`) situated at byte offset 4..36.

```text
Oracle v1 Account Layout (948 Bytes):
+--------------------+---------------------------------------+
| Offset (Bytes)     | Field                                 |
+--------------------+---------------------------------------+
| 0..4               | uint32_t version (= 1)                |
| 4..36              | uint8_t  authority_pubkey[32]         |
| 36..40             | uint32_t circuit_breaker_active       |
| 40..44             | uint32_t last_update_ts               |
| 44..48             | uint32_t entry_count (= 28)           |
| 48..52             | uint32_t regime_id                    |
| 52..948            | oracle_entry_t entries[28] (32B each) |
+--------------------+---------------------------------------+
```

Under Version 1, both automated high-frequency price updates (`ORACLE_INSTR_UPDATE`, opcode 1) and emergency administrative operations (`ORACLE_INSTR_RESUME`, opcode 2; `ORACLE_INSTR_REBASE`, opcode 3) require authorization from the same `authority_pubkey`.

This design has an inherent operational risk:
1. **Hot Key Privilege Escalation:** The automated feeder daemon must store the private key online to sign batches every block. If the feeder host is compromised, the attacker acquires full administrative authority to reset circuit breakers or rebase price baselines arbitrarily.
2. **Key Rotation Risk:** Single-step authority rotation risks permanent bricking of the oracle if a typo occurs in the target address.

---

## 2. Proposed Architecture (Version 2)

Version 2 introduces physical decoupling between the **Cold Admin Multisig** and the **Hot Automated Publisher**, alongside a **Two-Step Admin Handover Protocol**.

### 2.1 Account Header Layout

```text
Oracle v2 Account Header Layout (120 Bytes Header):
+--------------------+---------------------------------------+
| Offset (Bytes)     | Field                                 |
+--------------------+---------------------------------------+
| 0..4               | uint32_t version (= 2)                |
| 4..36              | uint8_t  admin_pubkey[32]             |
| 36..68             | uint8_t  publisher_pubkey[32]         |
| 68..100            | uint8_t  pending_admin_pubkey[32]     |
| 100..104           | uint32_t circuit_breaker_active       |
| 104..108           | uint32_t last_update_ts               |
| 108..112           | uint32_t entry_count                  |
| 112..116           | uint32_t regime_id                    |
| 116..120           | uint32_t reserved / flags             |
| 120..              | oracle_entry_t entries[N]             |
+--------------------+---------------------------------------+
```

### 2.2 Role Privilege Matrix

| Instruction Opcode | Operation | Permitted Signer | Rationale |
| :---: | :--- | :--- | :--- |
| `0x0001` | `UPDATE` | `publisher_pubkey` OR `admin_pubkey` | Automated ingestion routines. |
| `0x0002` | `RESUME` | `admin_pubkey` ONLY | Emergency reset after human incident review. |
| `0x0003` | `REBASE` | `admin_pubkey` ONLY | Fundamental baseline recalibration. |
| `0x0004` | `SET_PUBLISHER` | `admin_pubkey` ONLY | Immediate hot-key rotation/revocation. |
| `0x0005` | `PROPOSE_ADMIN` | `admin_pubkey` ONLY | Step 1 of cold governance transfer. |
| `0x0006` | `ACCEPT_ADMIN` | `pending_admin_pubkey` ONLY | Step 2 of cold governance transfer. |

### 2.3 Two-Step Admin Handover State Machine

To eliminate one-way rotation lockouts:

```text
       [ Current Admin ]
               │
               ▼
       PROPOSE_ADMIN(candidate_pubkey)
               │
               ├─────────────────────────────────────────────┐
               ▼                                             ▼
       pending_admin_pubkey = candidate           Admin executes CANCEL_PROPOSAL
               │                                             │
               ▼                                             ▼
       [ Candidate Signs ]                         pending_admin_pubkey = 0
       ACCEPT_ADMIN()
               │
               ▼
       admin_pubkey = pending_admin_pubkey
       pending_admin_pubkey = 0
```

1. **Step 1 (`PROPOSE_ADMIN`):** Current `admin_pubkey` writes the candidate address to `pending_admin_pubkey`. Existing governance authority remains with `admin_pubkey`.
2. **Step 2 (`ACCEPT_ADMIN`):** Candidate must sign an on-chain transaction matching `pending_admin_pubkey`. Upon signature verification, `admin_pubkey` is overwritten and `pending_admin_pubkey` is zeroed out.

---

## 3. Consequences & Migration Path

### Benefits
- **Zero Cold Exposure:** `admin_pubkey` stays offline in hardware security modules or multisig contracts; feeder instances only hold unprivileged `publisher_pubkey`.
- **Rapid Revocation:** If a publisher key is suspected compromised, `admin_pubkey` can immediately invoke `SET_PUBLISHER` to revoke it or point to a replacement instance.
- **Fail-Safe Governance:** Two-step handover guarantees that new admin credentials are valid and functional before releasing previous control.

### Operational Overhead
- Increases header size from 52 bytes to 120 bytes.
- Requires dual key management in the Feeder operator environment: operational feeder configs will specify `--publisher-key`, while break-glass scripts require `--admin-key`.
