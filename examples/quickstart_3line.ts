import { OracleClient } from "@thru-quant/core-sdk";

const client = new OracleClient({ daemonUrl: process.env.THRU_GATEWAY_URL || "http://localhost:8080" });
const quote = await client.getLatestPrice("BTC/USD");
console.log(`[Thru Oracle] ${quote.symbol}: $${quote.price} ± ${quote.confidence} (Slot #${quote.slot})`);
