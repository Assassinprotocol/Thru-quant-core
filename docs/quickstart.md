# Thru Quant Core — 5-Minute Developer Quickstart

Integrate real-time market data, deterministic fixed-point Q64.64 prices, and automated risk guards into your Thru dApp, lending protocol, or autonomous quant bot in under 5 minutes.

---

## 1. Quick Installation

### Option A: Direct Repository Use (Zero External NPM Dependencies)
```bash
git clone https://github.com/Assassinprotocol/Thru-quant-core.git
cd Thru-quant-core/sdk
npm install
npm run build
```

### Option B: Standalone Single-File Drop-In
Copy `sdk/dist/thru-oracle.js` into your project. It works in vanilla Node.js (v18+), Bun, Deno, or modern browsers with zero external dependencies.

---

## 2. Read On-Chain Oracle State in 4 Lines

Create `read_oracle.mjs`:

```javascript
import { OracleClient } from "./sdk/dist/client.js";

const client = new OracleClient({
  daemonUrl: "http://localhost:8082",                   // Local HTTP Daemon
  rpcUrl: "https://alphanet.thru.network/rpc",          // Alphanet Fallback
});

// Fetch latest on-chain state
const state = await client.getLatestState();
console.log(`Oracle Version: ${state.version} | Regime: ${state.regimeName}`);

// Read BTC quote in O(1) constant time
const btc = state.bySymbol["BTCUSDT"];
console.log(`BTC Price: $${btc.priceDecimal} (Volatility: ${btc.volatilityBps} bps)`);
```

Run with:
```bash
node read_oracle.mjs
```

---

## 3. Automated Pre-Trade Risk Evaluation

Protect your lending liquidations or trading bot from stale or halted oracles:

```javascript
import { OracleClient, evaluateRiskGate } from "./sdk/dist/index.js";

const client = new OracleClient();
const state = await client.getLatestState();

// Evaluate BTC against institutional risk policies
const risk = evaluateRiskGate(state, "BTCUSDT", {
  maxAgeSec: 120,          // Reject if data older than 2 minutes
  maxVolatilityBps: 300,   // Volatility spike limit (3.00%)
});

if (!risk.passed) {
  console.error("TRADE HALTED:", risk.reason);
} else if (risk.haircutPercent > 0) {
  console.warn(`APPLYING ${risk.haircutPercent}% COLLATERAL HAIRCUT:`, risk.reason);
} else {
  console.log("TRADE AUTHORIZED at price:", risk.quote.priceDecimal);
}
```

---

## 4. Operator CLI Diagnostics

Check oracle health and asset quotes directly from your terminal:

```bash
# View summary table of all 28 tracked assets and breaker state
./sdk/bin/cli.js status

# Inspect deep quote structure for a specific ticker
./sdk/bin/cli.js quote BTCUSDT

# Deserialize raw hex or base64 wire payload
./sdk/bin/cli.js decode <raw_hex_string>
```

---

## 5. Frequently Asked Questions (FAQ)

### What is Q64.64 fixed-point arithmetic?
On-chain contracts in ThruVM do not use floating-point numbers. Prices are stored as two 64-bit integer limbs: high 64 bits (integer part) and low 64 bits (fractional part scaled by $2^{64}$). Use `q64ToDecimalString(hi, lo)` in the SDK to guarantee zero precision loss.

### What should I do if `circuitBreakerActive` is `true`?
The circuit breaker trips if single-slot price deviation exceeds 5% (500 bps). All automated liquidations and trades MUST be paused until an authorized key submits the `RESUME` instruction (`020000000200`).

### Where can I inspect live Alphanet data?
The verified Alphanet Oracle storage account is:
`taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN`
Slot: `7743340` (and advancing).
