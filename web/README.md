# Sovereign Oracle Web Hub

Developer telemetry and monitoring console for Thru Quant Core v2.

## Capabilities

- **Consensus Feed Grid:** Real-time median prices, MAD confidence boundaries, active flags (`BIG_MOVE`, `LOW_CONFIDENCE`, `STALE`), and publisher quorum bitmasks.
- **Feed Deep Dive:** Interactive SVG price and confidence interval chart with 64-byte wire bytecode inspector.
- **Depeg & Volatility Monitor:** Basis-point deviation tracking for pegged assets (`USDC`, `USDT`, `DAI`) and rolling EWMA volatility.
- **Integration Playground:** Copy-paste integration snippets in C, Rust, TypeScript, and shell.
- **Zero-Telemetry Constraint:** 100% self-hosted assets; zero runtime external CDN requests.

## Commands

```bash
npm run build   # Production static prerender
npm test        # Unit tests
npm run dev     # Development server (http://localhost:3000)
```
