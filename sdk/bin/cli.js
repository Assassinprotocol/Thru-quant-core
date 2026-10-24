#!/usr/bin/env node

/**
 * @file cli.js
 * @description Zero-dependency CLI diagnostic tool for Thru Quant Oracle.
 */

import { OracleClient } from "../dist/client.js";
import { decodeOracleBase64, decodeOracleHex } from "../dist/decoder.js";
import { formatBps } from "../dist/math.js";

const args = process.argv.slice(2);
const command = args[0] || "help";

function printHelp() {
  console.log(`
\x1b[1m\x1b[36mThru Quant Core — Operator CLI Diagnostic Tool (v1.0.0)\x1b[0m
Usage:
  thru-oracle status   [--daemon <url>] [--rpc <url>]   Show on-chain oracle status table
  thru-oracle quote    <symbol> [--daemon <url>]        Inspect detailed quote for a specific ticker
  thru-oracle decode   <hex|base64>                     Deserialize wire payload from raw string
  thru-oracle help                                      Display this help manual

Options:
  --daemon <url>     HTTP daemon address (default: http://localhost:8080)
  --rpc <url>        Thru JSON-RPC node address (default: https://rpc.betanet.thru.org)
  --account <addr>   Oracle storage account address
`);
}

function getOption(flag, defaultValue) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return defaultValue;
}

async function handleStatus() {
  const daemonUrl = getOption("--daemon", "http://localhost:8080");
  const rpcUrl = getOption("--rpc", "https://rpc.betanet.thru.org");
  const accountAddress = getOption(
    "--account",
    "taQbv-8fTNz3pEM9T5y0Ik61jtDV7BWMdmJFjh0c3FvwPN"
  );

  console.log(`\x1b[34m[THRU ORACLE]\x1b[0m Connecting to Oracle... (Daemon: ${daemonUrl}, Account: ${accountAddress})`);
  const client = new OracleClient({ daemonUrl, rpcUrl, accountAddress });

  try {
    const state = await client.getLatestState();
    const cbStatus = state.circuitBreakerActive
      ? "\x1b[1m\x1b[31m[TRIPPED / HALTED]\x1b[0m"
      : "\x1b[1m\x1b[32m[NORMAL / ACTIVE]\x1b[0m";

    console.log("\n================================================================================");
    console.log(` \x1b[1mTHRU ON-CHAIN MARKET ORACLE STATUS\x1b[0m`);
    console.log("================================================================================");
    console.log(` Version:         ${state.version}`);
    console.log(` Authority:       ${state.authorityPubkey}`);
    console.log(` Circuit Breaker: ${cbStatus}`);
    console.log(` Market Regime:   \x1b[33m${state.regimeName}\x1b[0m (ID: ${state.regimeId})`);
    console.log(` Last Update:     ${new Date(state.lastUpdateTs * 1000).toISOString()} (${state.feedAgeSec}s ago)`);
    console.log(` Tracked Assets:  ${state.entryCount} symbols`);
    console.log("--------------------------------------------------------------------------------");
    console.log(
      ` ${"ID".padEnd(4)} | ${"SYMBOL".padEnd(10)} | ${"PRICE (USD)".padEnd(16)} | ${"VOLATILITY".padEnd(12)} | ${"AGE (SEC)".padEnd(10)}`
    );
    console.log("--------------------------------------------------------------------------------");

    for (const e of state.entries) {
      const priceStr = `$${e.priceDecimal}`;
      const volStr = formatBps(e.volatilityBps);
      console.log(
        ` ${e.symbolId.toString().padEnd(4)} | ${e.symbol.padEnd(10)} | ${priceStr.padEnd(16)} | ${volStr.padEnd(12)} | ${e.ageSec.toString().padEnd(10)}`
      );
    }
    console.log("================================================================================\n");
  } catch (err) {
    console.error(`\x1b[31mError fetching state:\x1b[0m`, err.message);
    process.exit(1);
  }
}

async function handleQuote(symbol) {
  if (!symbol) {
    console.error("\x1b[31mError:\x1b[0m Symbol ticker required (e.g. thru-oracle quote BTCUSDT)");
    process.exit(1);
  }

  const daemonUrl = getOption("--daemon", "http://localhost:8080");
  const rpcUrl = getOption("--rpc", "https://rpc.betanet.thru.org");
  const client = new OracleClient({ daemonUrl, rpcUrl });

  try {
    const quote = await client.getQuote(symbol.toUpperCase());
    console.log(`\n\x1b[1m\x1b[36m=== Quote: ${quote.symbol} ===\x1b[0m`);
    console.log(` Symbol ID:       ${quote.symbolId}`);
    console.log(` Exact Price:     $${quote.priceDecimal}`);
    console.log(` Float Approx:    $${quote.price.toFixed(4)}`);
    console.log(` Q64 Limb Hi:     ${quote.priceQ64Hi.toString()}`);
    console.log(` Q64 Limb Lo:     ${quote.priceQ64Lo.toString()}`);
    console.log(` Volatility:      ${formatBps(quote.volatilityBps)} (${quote.volatilityBps} bps)`);
    console.log(` Observation TS:  ${new Date(quote.timestamp * 1000).toISOString()}`);
    console.log(` Quote Age:       ${quote.ageSec} seconds`);
  } catch (err) {
    console.error(`\x1b[31mError fetching quote for ${symbol}:\x1b[0m`, err.message);
    process.exit(1);
  }
}

function handleDecode(raw) {
  if (!raw) {
    console.error("\x1b[31mError:\x1b[0m Raw hex or base64 string required");
    process.exit(1);
  }

  try {
    let state;
    if (raw.startsWith("0x") || /^[0-9a-fA-F]+$/.test(raw)) {
      state = decodeOracleHex(raw);
    } else {
      state = decodeOracleBase64(raw);
    }

    console.log("\x1b[32mSuccessfully decoded wire payload:\x1b[0m");
    console.log(JSON.stringify(state, (k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  } catch (err) {
    console.error("\x1b[31mDeserialization failed:\x1b[0m", err.message);
    process.exit(1);
  }
}

switch (command) {
  case "status":
    handleStatus();
    break;
  case "quote":
    handleQuote(args[1]);
    break;
  case "decode":
    handleDecode(args[1]);
    break;
  case "help":
  default:
    printHelp();
    break;
}
