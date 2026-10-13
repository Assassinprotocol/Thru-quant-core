# Thru Quant Core (thru-quant-core)

High-performance institutional Quant & DeFi infrastructure purpose-built for the **Thru Network** (`thru.org` / `thru.xyz`), powered by Unto Labs and ThruVM (RISC-V RV64IMC).

---

## 🏛 Architecture Overview

`thru-quant-core` delivers high-frequency trading capabilities, continuous pricing feeds, and order execution with:

1. **Deterministic Q64.64 Fixed-Point Arithmetic (`include/thru_math.h`, `src/thru_math.c`)**
   - Implements Taylor series exponential, binary digit-by-digit square root, and bit-normalized logarithmic algorithms using 64-bit integer instructions.
   - Clean C implementation free of unnecessary inlines.

2. **Market Oracle Contract (`src/market_oracle.c`, `src/market_oracle.abi.yaml`)**
   - High-density packed struct storing live quotes for 32 crypto assets.
   - On-chain market regime indicator (`0: Neutral/Ranging`, `1: Trending Up`, `2: Trending Down`, `3: Volatility Spike`).
   - Zero-copy direct memory access (`tsdk_get_account_data_ptr`).

3. **Monolithic CLOB Engine (`src/clob_engine.c`, `src/clob_engine.abi.yaml`)**
   - Monolithic contiguous ring-buffer limit orderbook residing in a single Thru account (up to 16MB direct memory space).
   - In-memory price-time matching engine supporting resting bids/asks, crossing matches, partial fills, and cancellations.

4. **Zero-Rate-Limit Feeder Pipeline (`feeder/main.go`)**
   - Taps Hansen Engine's local memory buffers and disk state directly (`market_history.json`, `market_regime.json`).
   - Consumes **0 Binance API requests** / 0 external rate limit quota.
   - Encodes binary instruction payloads and communicates with Thru RPC.

5. **Institutional Visualizer (`visualizer/index.html`)**
   - Real-time dark-mode terminal visualizer for market depth, spreads, quotes, and regime state.

---

## 🛠 Compilation & Toolchain

### Prerequisites
- Thru CLI (`thru 0.4.1+`)
- RISC-V Cross-Compiler (`thru dev toolchain install`)
- Thru C SDK (`thru dev sdk install c`)

### Building Contracts
```bash
# Compile both contracts to ThruVM RISC-V binaries
make -j4
```
Outputs are generated in `build/thruvm/bin/`:
- `market_oracle_c.bin` & `market_oracle_c.elf`
- `clob_engine_c.bin` & `clob_engine_c.elf`

### Running Test Suite
```bash
# 1. Math unit tests
gcc -O2 -Iinclude tests/test_thru_math.c src/thru_math.c -o tests/test_math && ./tests/test_math

# 2. Host architectural simulation (Oracle + CLOB matching)
gcc -O2 -Iinclude -Isrc tests/test_simulation.c src/thru_math.c -o tests/test_simulation && ./tests/test_simulation
```

### Validating ABI Schemas
```bash
thru abi analyze -f src/market_oracle.abi.yaml
thru abi analyze -f src/clob_engine.abi.yaml
```

---

## ⚡ Feeder Execution
```bash
# Dry run verification
cd feeder && go run main.go --dry-run --once

# Live daemon mode
cd feeder && go run main.go --interval 5s
```
