"use client";

import type { TelemetryStatus } from "../types";

interface SloMetricsProps {
  status: TelemetryStatus;
}

export function SloMetrics({ status }: SloMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">P99 DECODE LATENCY</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-bold tabular text-emerald-400">~{status.p99LatencyUs}</span>
          <span className="text-[11px] text-zinc-400">µs</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Zero heap alloc</div>
      </div>

      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">CONSENSUS QUORUM</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-bold tabular text-white">6 / 7</span>
          <span className="text-[11px] text-zinc-400">pubs</span>
        </div>
        <div className="mt-0.5 text-[10px] text-emerald-400">Threshold 5/7 met</div>
      </div>

      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">FRESHNESS SLO</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-bold tabular text-white">&lt; 400</span>
          <span className="text-[11px] text-zinc-400">ms</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Max stale: 60s</div>
      </div>

      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">CONFIDENCE MODEL</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-bold text-white">MAD</span>
          <span className="text-[11px] text-zinc-400">(k=1.4826)</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Outlier resistant</div>
      </div>

      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">CIRCUIT BREAKER</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span
            className={`text-base font-bold ${
              status.circuitBreakerActive ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {status.circuitBreakerActive ? "TRIPPED" : "NOMINAL"}
          </span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">Max delta: 500 bps</div>
      </div>

      <div className="rounded border border-[#1e293b] bg-[#0c101d] p-3 font-mono">
        <div className="text-[10px] text-zinc-400">MEMORY PROFILE</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-base font-bold tabular text-white">&lt; 12</span>
          <span className="text-[11px] text-zinc-400">MB</span>
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500">C99 ring buffer</div>
      </div>
    </div>
  );
}
