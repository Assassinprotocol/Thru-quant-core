# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
