# Betanet Deployment Evidence Register

- **Network:** Thru Betanet (`https://rpc.betanet.thru.org`, Chain ID 2)
- **Status:** Active Target (Tier T0: Single-Publisher, Experimental)
- **Toolchain:** `rv64imc_zba_zbb_zbc_zbs_zknh` via `riscv64-unknown-elf-gcc 15.2.0`
- **Program Binary:** `build/thruvm/bin/market_oracle_c.bin` (15,872 Bytes <= 32 KB ceiling)
- **Binary SHA-256:** `553941902b318e25d6df2329434bffe66183ad532c81e1eb6c49b9cb3aa1c3da`
- **ABI Layout:** `src/market_oracle.abi.yaml` (948 Bytes packed account struct)
- **Execution Budget:** Max compute units per txn: 42 CU (feature-gate enforced on-chain)
- **Orchestration Tool:** `scripts/deploy.py` (idempotent, dry-run verified)
