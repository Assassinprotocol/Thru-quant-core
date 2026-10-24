"use client";

import type { TelemetryStatus } from "../types";

interface HeaderProps {
  status: TelemetryStatus;
  onRefresh: () => void;
  onGatewayUrlChange: (url: string) => void;
  onSimulateBreaker: () => void;
}

export function Header({ status, onRefresh, onGatewayUrlChange, onSimulateBreaker }: HeaderProps) {
  return (
    <header className="border-b border-[#1e293b] bg-[#0c101d] px-4 py-3 md:px-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-400 font-mono font-bold text-sm">
            TQ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-white text-base">THRU QUANT CORE</span>
              <span className="rounded bg-[#1e293b] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">v1.0.0</span>
            </div>
            <p className="text-[11px] text-zinc-400 font-mono">Sovereign Oracle Telemetry & Risk Terminal</p>
          </div>

          <div className="ml-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium ${
                status.mode === "SSE"
                  ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                  : status.mode === "POLLING"
                  ? "bg-amber-950/80 text-amber-400 border border-amber-500/30"
                  : "bg-zinc-800 text-zinc-300 border border-zinc-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  status.mode === "SSE"
                    ? "bg-emerald-400 animate-pulse"
                    : status.mode === "POLLING"
                    ? "bg-amber-400"
                    : "bg-zinc-400"
                }`}
              />
              {status.mode}
            </span>

            <span
              className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                status.circuitBreakerActive
                  ? "bg-rose-950/80 text-rose-400 border-rose-500/40"
                  : "bg-emerald-950/50 text-emerald-400 border-emerald-500/20"
              }`}
            >
              BREAKER: {status.circuitBreakerActive ? "TRIPPED" : "NOMINAL"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 rounded border border-[#1e293b] bg-[#07090e] px-2.5 py-1">
            <span className="text-zinc-500 font-mono text-[11px]">GATEWAY:</span>
            <input
              type="text"
              value={status.gatewayUrl}
              onChange={(e) => onGatewayUrlChange(e.target.value)}
              className="bg-transparent font-mono text-[11px] text-zinc-300 outline-none w-36 focus:text-white"
              placeholder="http://localhost:8080"
            />
          </div>

          <div className="hidden sm:flex items-center gap-4 rounded border border-[#1e293b] bg-[#07090e] px-3 py-1 font-mono text-[11px]">
            <div>
              <span className="text-zinc-500">SLOT: </span>
              <span className="tabular text-zinc-200">#{status.slot.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-zinc-500">DECODE P99: </span>
              <span className="tabular text-emerald-400">~{status.p99LatencyUs}µs</span>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="rounded border border-[#1e293b] bg-[#121727] px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            REFRESH
          </button>

          <button
            onClick={onSimulateBreaker}
            className={`rounded px-2.5 py-1 font-mono text-[11px] border transition-colors cursor-pointer ${
              status.circuitBreakerActive
                ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60"
                : "border-rose-950 bg-rose-950/30 text-rose-300 hover:border-rose-500 hover:bg-rose-950/60"
            }`}
          >
            {status.circuitBreakerActive ? "RESET BREAKER" : "SIMULATE BREAKER"}
          </button>
        </div>
      </div>
    </header>
  );
}
