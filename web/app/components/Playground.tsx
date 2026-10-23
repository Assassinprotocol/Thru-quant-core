"use client";

import { useState } from "react";
import type { OracleFeed } from "../types";

interface PlaygroundProps {
  selectedFeed: OracleFeed;
}

export function Playground({ selectedFeed }: PlaygroundProps) {
  const [activeTab, setActiveTab] = useState<"c" | "rust" | "ts" | "curl">("c");
  const [copied, setCopied] = useState(false);

  const cleanSymbol = selectedFeed.symbol;
  const baseSymbol = selectedFeed.base;

  const snippets = {
    c: `// Zero-Copy Direct Memory Cast in C (On-Chain / Fast Ingestion)
#include "thru_quant_core.h"

int evaluate_price(const uint8_t *raw_account_data, size_t len) {
    if (len < sizeof(thru_oracle_entry_t)) return -1;
    
    // Direct zero-allocation cast (~3.5µs decode latency)
    const thru_oracle_entry_t *entry = (const thru_oracle_entry_t *)raw_account_data;
    if (entry->magic != THRU_ORACLE_MAGIC) return -2;

    double price = (double)entry->price_q64 / 18446744073709551616.0;
    double conf  = (double)entry->conf_q64 / 18446744073709551616.0;
    
    // Check flags for BIG_MOVE or LOW_CONFIDENCE
    if (entry->flags & THRU_FLAG_CIRCUIT_BREAKER) return -3;
    
    return 0;
}`,
    rust: `// Zero-Copy On-Chain CPI Deserialization in Rust
use thru_quant_core_sdk::OracleEntry;

pub fn process_oracle_valuation(account_data: &[u8]) -> Result<(u128, u64), ProgramError> {
    // 0-copy byte transmutation
    let entry = OracleEntry::from_bytes(account_data)
        .map_err(|_| ProgramError::InvalidAccountData)?;

    // Safe asymmetric valuation: P - k * conf for collateral
    let safe_collateral_price = entry.price_q64.saturating_sub(entry.conf_q64);
    
    Ok((safe_collateral_price, entry.slot))
}`,
    ts: `// TypeScript SDK Integration (@thru-quant/core-sdk)
import { OracleClient } from "@thru-quant/core-sdk";

const client = new OracleClient({ endpoint: "http://localhost:8080" });

// Read latest consolidated feed
const feed = await client.getLatestPrice("${cleanSymbol}");
console.log(\`Price: \${feed.price} ± \${feed.confidence} (Slot #\${feed.slot})\`);

// Stream live real-time updates via SSE
client.watchFeed("${cleanSymbol}", (update) => {
  console.log("Real-time update:", update.slot, update.price);
});`,
    curl: `# Query feed via REST API Gateway v2
curl -s "http://localhost:8080/v2/feeds/${cleanSymbol}" \\
  -H "X-Oracle-Mode: strict" | jq .

# Stream Server-Sent Events (SSE)
curl -N "http://localhost:8080/v2/feeds/${cleanSymbol}/stream"`,
  };

  const copyCode = () => {
    navigator.clipboard.writeText(snippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0c101d] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between border-b border-[#1e293b] px-4 py-2.5 bg-[#090d18]">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Integration Playground
          </span>
          <span className="rounded bg-[#1e293b] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
            Target: {cleanSymbol}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded border border-[#1e293b] bg-[#070a12] p-0.5 font-mono text-[11px]">
            {(["c", "rust", "ts", "curl"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded px-2.5 py-0.5 uppercase transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#1e293b] text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab === "ts" ? "TypeScript" : tab === "curl" ? "Shell / cURL" : tab.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={copyCode}
            className="rounded border border-[#1e293b] bg-[#141b2e] px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            {copied ? "COPIED SNIPPET" : "COPY SNIPPET"}
          </button>
        </div>
      </div>

      <div className="p-4 bg-[#070a12]">
        <pre className="font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
          <code>{snippets[activeTab]}</code>
        </pre>
      </div>
    </div>
  );
}
