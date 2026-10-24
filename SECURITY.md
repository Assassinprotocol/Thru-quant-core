# Security Policy

## 1. Supported Versions

Security updates and vulnerability patches are actively maintained for the following releases:

| Version | Supported | Consensus Tier | Environment |
|---|:---:|---|---|
| `v1.0.x` | **Active / Production** | Tier T2 (Multi-Operator Sovereign Oracle) | Thru Betanet |
| `v0.5.x` | Security Fixes Only | Tier T0 (Single Publisher) | Thru Betanet |
| `< v0.5.0` | No | Legacy Prototype / Alphanet Archive | Deprecated |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability in Thru Quant Core, do not disclose it publicly or open an issue on GitHub. 

Please report all security issues directly to the security response team:
- **Email:** `security@thru.network`
- **Response SLA:**
  - Initial Acknowledgement: Within 24 hours.
  - Triage & Severity Assessment: Within 72 hours.
  - Remediation Patch & Verification: Within 14 days.

---

## 3. Scope of Verification

The following components are strictly in scope for security evaluations:

1. **On-Chain Contracts (`src/`):** Arithmetic safety, memory safety (ASan/UBSan), bounds verification, fail-closed clock assertions, and authority controls.
2. **Ingestion & Quorum Feeder (`feeder/`):** Outlier rejection, price serialization, and publisher key integrity.
3. **API Gateway & Indexer (`gateway/`, `indexer/`):** Deserialization attacks, SQL injection, denial-of-service resilience, and SSE client pooling.
4. **TypeScript SDK (`sdk/`):** Zero-copy wire decoders, program pinning, and asymmetric safe valuation calculations.

---

## 4. Coordinated Disclosure Guidelines

1. Security researchers agree to maintain confidentiality until a patch is released and audited on Betanet.
2. The core engineering team agrees to provide public attribution and credit in release notes.
3. Once resolved, a formal post-mortem with root-cause analysis will be published in `docs/drills/`.
