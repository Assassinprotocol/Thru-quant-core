# Thru Quant Core — Audit Remediation & Regression Ledger

**Document Status:** OFFICIAL AUDIT REMEDIATION REGISTER  
**Audit Report:** [`docs/audit/external-audit-report.md`](file:///home/hansen/AI/thru_quant_core/docs/audit/external-audit-report.md)  
**Verification Harness:** [`tests/test_audit_remediation.ts`](file:///home/hansen/AI/thru_quant_core/tests/test_audit_remediation.ts)  
**Makefile Target:** `make test-audit-remediation`  

---

## 1. Remediation Tracking Matrix

| Finding ID | Severity | Description | Remediating Files | Invariant | Automated Test | Status |
|---|:---:|---|---|:---:|---|:---:|
| **TPC-01** | Medium | Monotonic timestamps across slot skips | `src/market_oracle.c`<br>`sdk/src/encoder.ts` | **INV-2** | `test_audit_remediation.ts` (TPC-01) | **VERIFIED** |
| **TPC-02** | Medium | Client IP resolution & rate limiter bypass | `api/server.go`<br>`docs/reverse-proxy.md` | **INV-7** | `test_audit_remediation.ts` (TPC-02) | **VERIFIED** |
| **TPC-03** | Low | Feeder quote buffer memory cap | `feeder/quorum/quorum.go` | **INV-8** | `test_audit_remediation.ts` (TPC-03) | **VERIFIED** |
| **TPC-04** | Low | Client-side ABI array capacity enforcement | `sdk/src/encoder.ts` | **INV-1** | `test_audit_remediation.ts` (TPC-04) | **VERIFIED** |
| **TPC-05** | Info | Progressive volatility haircut scaling | `sdk/src/guards.ts` | **INV-5** | `test_audit_remediation.ts` (TPC-05) | **VERIFIED** |

---

## 2. Invariant Proof Summary

1. **INV-1 (Symbol Capacity Bound):**
   - The contract wire payload strictly limits entries to `MAX_ORACLE_SYMBOLS` (32).
   - Enforced by both on-chain check (`entries_count <= 32`) and SDK validation guard (`Cannot encode more than 32 symbols`).

2. **INV-2 (Timestamp Monotonicity):**
   - Enforced on-chain via error code `0x200E`: every incoming quote must satisfy `source_ts > prev_source_ts`.
   - Protects against quote replay and backdated state injections.

3. **INV-5 (Collateral Haircut Calibration):**
   - Enforced client-side in DeFi consumer integration guards.
   - Assets exhibiting volatility $> 400\text{ bps}$ incur an immediate 25% safety haircut to protect lending solvency.

4. **INV-7 (Proxy Trust Boundary):**
   - Direct socket address inspection prevents spoofing of `X-Forwarded-For` or `CF-Connecting-IP` headers.

5. **INV-8 (Bounded Memory Footprint):**
   - Memory rings discard quotes older than 128 slots, preventing memory leak regressions under high TPS.

---

## 3. Verification Command

```bash
make test-audit-remediation
```
Expected output: 5 passing tests with zero failures.
