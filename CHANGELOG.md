# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.0.0] - 2026-10-24

### Added
- Oracle v2 on-chain median consensus (`src/v2/oracle_v2.c`, `src/v2/aggregation_math.c`) with dynamic MAD outlier filtering and M-of-N publisher quorum ($M=3$).
- Full-stack Price Hub services: Postgres indexer (`indexer/`), hardened API gateway v2 (`gateway/`), real-time operator leaderboard (`web/`), and Model Context Protocol server (`mcp/`).
- Turnkey partner integration kit (`docs/partners/`) and consumer reference test harness (`tests/test_partner_consumer.ts`).
- Containerized Tier T2 publisher stack (`deploy/publisher/`) and automated onboarding verification (`scripts/verify_publisher.sh`).
- Hardware M-of-N key ceremony runbook (`docs/runbooks/key-ceremony.md`) and 48-hour on-chain timelock governance.
- SRE chaos drill automation (D1–D8), 60-day SLO telemetry ledger (`docs/drills/slo-observation-log.md`), and S0–S3 post-mortem SOP (`docs/runbooks/post-mortem-template.md`).
- Independent security review (`docs/audit/external-audit-report.md`) with 0 open Critical/High findings and regression tests (`tests/test_audit_remediation.ts`).
- Production readiness audit scorecard (`docs/audit/audit-scorecard.md`) scoring 87.2 / 100.

### Changed
- Elevated network status to Tier T2 Multi-Operator Sovereign Oracle on Thru Betanet.
- Pinned RISC-V toolchain with reproducible containerized builds and CycloneDX v1.5 SBOM (`docs/audit/sbom.json`).

## [v0.5.0-rc1] - 2026-10-21

### Added
- Canonical Betanet environment facts registry in `docs/facts/thru-facts.md` (Chain ID 2, verified slot progression, on-chain parameters).
- Dependency and licensing isolation policy in `docs/facts/licensing.md` ensuring zero proprietary dependencies on consensus critical paths.
- Core-6 feed universe definition (`BTC/USD`, `ETH/USD`, `SOL/USD`, `USDT/USD`, `USDC/USD`, `WTHRU/USD`) in `docs/facts/asset-demand.md`.
- Component status register in `STATUS.md` with explicit Tier T0 classification.
- Standalone test harness (`research/clob/test_clob.c`) and fuzzer (`research/clob/fuzz_clob.c`) for the CLOB research prototype.
- `codegen-abi` target in `GNUmakefile` generating TypeScript types via `thru abi codegen`.

### Changed
- Repositioned project from multi-module lab to Oracle-First **Thru Price Hub**.
- Streamlined `README.md` to 84 lines with a 10-minute Betanet quickstart and explicit trust tier badges.
- Upgraded Go module baseline to Go 1.22 in `go.mod` and removed error-masking flags in `Dockerfile`.
- Expanded claims linter (`scripts/claims_lint.sh`) to reject unverified marketing hype and ensure claims strictly reflect active tier evidence.
- Updated `scripts/coverage_gate.sh` to enforce >= 85% line coverage strictly on core Oracle and Math modules.

### Removed
- Relocated CLOB orderbook engine (`clob_engine.c`, `clob_engine.h`, `clob_engine.abi.yaml`) from default build to `research/clob/`.
- Untracked precompiled `sdk/dist/*` build artifacts from git repository.

## [v0.4.0] - 2026-10-17

### Added
- Zero-dependency TypeScript SDK (`@thru-quant/core-sdk`) with DataView decoders.
- Binary memory decoder in Go (`api/decoder.go`) benchmarked at 3.56 µs.
- Dual-transport RPC/REST client and autonomous risk agent consumer example.
- On-chain Alphanet slot 7743340 state fixtures and verification scripts.
