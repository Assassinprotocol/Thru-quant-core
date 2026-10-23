"use client";

import type { RiskSignal } from "../types";

interface RiskMonitorProps {
  signals: RiskSignal[];
}

export function RiskMonitor({ signals }: RiskMonitorProps) {
  const stableSignals = signals.filter((s) => ["USDC/USD", "USDT/USD", "DAI/USD"].includes(s.symbol));
  const volatileSignals = signals.filter((s) => !["USDC/USD", "USDT/USD", "DAI/USD"].includes(s.symbol));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-6 rounded-lg border border-[#1e293b] bg-[#0c101d] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-2.5 bg-[#090d18]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Stablecoin Depeg Monitor
            </span>
            <span className="rounded bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.2 font-mono text-[10px] text-emerald-400">
              Peg Ref: $1.0000
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">Threshold: ±50 bps</span>
        </div>

        <div className="p-4 space-y-4">
          {stableSignals.map((sig) => {
            const bps = sig.depegBps ?? 0;
            const absBps = Math.abs(bps);
            const statusColor =
              absBps > 50
                ? "text-rose-400 bg-rose-950/70 border-rose-500/40"
                : absBps > 20
                ? "text-amber-400 bg-amber-950/70 border-amber-500/40"
                : "text-emerald-400 bg-emerald-950/70 border-emerald-500/30";

            // Visual meter mapping: -50 bps = 0%, 0 bps = 50%, +50 bps = 100%
            const clampedBps = Math.max(-50, Math.min(50, bps));
            const markerPos = ((clampedBps + 50) / 100) * 100;

            return (
              <div key={sig.symbol} className="rounded border border-[#1e293b] bg-[#080b15] p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">{sig.symbol}</span>
                    <span className={`rounded border px-1.5 py-0.2 font-mono text-[10px] font-semibold ${statusColor}`}>
                      {bps >= 0 ? `+${bps}` : `${bps}`} bps
                    </span>
                  </div>
                  <div className="font-mono text-xs tabular text-zinc-300">
                    Ratio: {sig.depegRatio ? sig.depegRatio.toFixed(4) : "1.0000"}
                  </div>
                </div>

                <div className="relative h-2 w-full rounded bg-[#151c2e] overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-[48%] w-[4%] bg-zinc-600" />
                  <div
                    className={`absolute top-0 bottom-0 w-2 rounded-full transition-all duration-300 ${
                      absBps > 50 ? "bg-rose-500" : absBps > 20 ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                    style={{ left: `calc(${markerPos}% - 4px)` }}
                  />
                </div>

                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>-50 bps (Discount)</span>
                  <span className="text-zinc-400">PAR (1.0)</span>
                  <span>+50 bps (Premium)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-6 rounded-lg border border-[#1e293b] bg-[#0c101d] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-2.5 bg-[#090d18]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wider">
              Rolling Volatility & Regime Classifier
            </span>
          </div>
          <span className="font-mono text-[11px] text-zinc-500">EWMA Sigma</span>
        </div>

        <div className="p-4 space-y-3">
          {volatileSignals.map((sig) => {
            const regimeBadge =
              sig.regime === "VOLATILE_EXPANSION"
                ? "bg-rose-950/70 border-rose-500/40 text-rose-300"
                : sig.regime === "TRENDING_UP"
                ? "bg-emerald-950/70 border-emerald-500/30 text-emerald-300"
                : sig.regime === "TRENDING_DOWN"
                ? "bg-amber-950/70 border-amber-500/40 text-amber-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-300";

            return (
              <div key={sig.symbol} className="rounded border border-[#1e293b] bg-[#080b15] p-3 font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">{sig.symbol}</span>
                  <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${regimeBadge}`}>
                    {sig.regime.replace("_", " ")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded bg-[#0f1424] p-2 border border-[#1a233a]">
                    <div className="text-[10px] text-zinc-400">15-MIN VOLATILITY</div>
                    <div className="text-sm font-semibold tabular text-emerald-400">
                      {sig.volatility15mBps} <span className="text-[10px] text-zinc-400">bps</span>
                    </div>
                  </div>

                  <div className="rounded bg-[#0f1424] p-2 border border-[#1a233a]">
                    <div className="text-[10px] text-zinc-400">1-HOUR VOLATILITY</div>
                    <div className="text-sm font-semibold tabular text-zinc-200">
                      {sig.volatility1hBps} <span className="text-[10px] text-zinc-400">bps</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
