# Thru Price Hub — Licensing & Dependency Boundary Policy

**Status:** Canonical Policy  
**Effective Date:** 2026-10-21  

---

## 1. Core Licensing Matrix

| Component | Repository Path | Applicable License | Upstream Source | Verification / Notice |
|---|---|---|---|---|
| **Thru Quant Core** | Root | **MIT License** | `github.com/Assassinprotocol/Thru-quant-core` | `LICENSE` in repository root |
| **Thru C Program SDK** | `include/`, vendor headers | **Apache-2.0 / MIT** | `github.com/Unto-Labs/thru` (`thru-sdk`) | Open source dual-license |
| **Picolibc** | Toolchain sysroot | **BSD-3-Clause** | Keith Packard / Picolibc project | Standard embedded libc |
| **blst Signature Library** | Linked binary | **Apache-2.0** | Supranational LLC | Cryptographic verification |
| **Go Publisher / Daemon** | `feeder/`, `cmd/` | **BSD-3-Clause / MIT** | Go Standard Library | Go stdlib clean |
| **TypeScript SDK** | `sdk/` | **MIT License** | `@thru-quant/core-sdk` | Zero external runtime deps |

---

## 2. Dependency Boundary Rules (Critical Path Isolation)

To ensure sovereignty, reproducibility, and auditability:

1. **Zero Proprietary Packages on Critical Path:**
   - The on-chain contracts (`src/market_oracle.c`, `src/thru_math.c`), the publisher service (`feeder/`), and verification scripts (`scripts/`) must remain **100% free of proprietary npm or closed SDK packages**.
2. **Direct gRPC / REST Wire Protocol:**
   - All chain communications directly target standard protobuf/gRPC and HTTP/2 RPC endpoints (`https://rpc.betanet.thru.org`), eliminating dependency on third-party client wrappers.
3. **Decoupled Developer Tooling:**
   - Optional auxiliary developer tools (e.g. Explorer UI plugins or Next.js Web Hub) may consume `@thru/*` packages only if their licensing permits, maintaining strict isolation from the consensus data pipeline.
