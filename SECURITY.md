# Security Policy

## Supported Versions

| Version | Supported | Security Maintenance Status |
| :---: | :---: | :--- |
| `0.4.x` | Yes | Active development and security patch branch |
| `< 0.4.0` | No | Prototype previews (deprecated) |

---

## Reporting a Vulnerability

We treat all security vulnerabilities with utmost priority. If you discover a potential vulnerability in the **Thru Quant Core** contracts, math library, feeder, or API daemon, please follow our coordinated disclosure policy.

### Reporting Channel
- **Email:** `security@thru-quant.internal` (or file a private security advisory via GitHub Security Advisories).
- **Encryption:** Use PGP encryption for sensitive reports when requested.

### Information to Include
1. Component name and file path (e.g. `src/market_oracle.c`, `src/thru_math.c`).
2. Type of vulnerability (e.g. integer overflow, unauthorized state transition, logic flaw, denial of service).
3. Step-by-step reproduction instructions or a minimal test vector / proof-of-concept.
4. Estimated potential impact on funds, state consistency, or liveness.

### Response Timelines
- **Initial Acknowledgment:** Within 24 hours of receipt.
- **Triage & Severity Assessment:** Within 48 hours.
- **Remediation & Patch Release:** Within 72 hours for critical vulnerabilities.

---

## Security Invariants & Scope

### In-Scope Components
- **C Core Contracts (`src/market_oracle.c`):**
  - Authority signer verification (`ORACLE_ERR_UNAUTHORIZED = 0x2003`).
  - Pre-validation and circuit breaker bounds ($\le 500$ bps).
  - Monotonic timestamp regression protection (`0x200E`).
- **Research Prototypes (`research/clob/`):**
  - Evaluated under research scope: order placement, cancellation authority, and FIFO priority.
  - Note: Non-custodial research prototype without escrow.
- **Fixed-Point Math Library (`src/thru_math.c`, `include/thru_math.h`):**
  - Q64.64 checked arithmetic (`q64_status_t`).
  - Range reduction and polynomial bounds for $\exp$ and $\ln$.
- **Off-Chain Feeder & API (`feeder/`, `api/`):**
  - Write deadlines and denial-of-service resistance on streaming endpoints.
  - Fail-closed RPC validation.

### Out of Scope
- Denial of Service on public third-party RPC endpoints or testnet validator consensus.
- Social engineering attacks against operators.
- Bugs in underlying hardware or toolchain compilers unless reproducible with explicit flags.
