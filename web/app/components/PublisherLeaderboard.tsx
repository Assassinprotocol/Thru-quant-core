"use client";

import { useState } from "react";
import type { PublisherOperator } from "../types";

interface PublisherLeaderboardProps {
  publishers: PublisherOperator[];
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  DEGRADED: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  OFFLINE: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
};

function formatKey(key: string): string {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function PublisherLeaderboard({ publishers }: PublisherLeaderboardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(key);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  };

  const activeCount = publishers.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="rounded border border-[#1e293b] bg-[#0c101d] p-4 md:p-5 font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1e293b]">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              Tier T2 Multi-Operator Quorum
            </span>
            <span className="rounded bg-[#1e293b] px-2 py-0.5 text-[10px] text-zinc-400">
              Min Quorum: 3 / Max: 7
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            Independent publisher nodes contributing cryptographically signed quotes to on-chain MAD consensus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded border border-[#1e293b] bg-[#07090e] px-3 py-1.5 text-right">
            <div className="text-[10px] text-zinc-500">ACTIVE QUORUM</div>
            <div className="text-sm font-bold tabular-nums text-emerald-400">
              {activeCount} / {publishers.length} Nodes
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#1e293b] text-[10px] uppercase text-zinc-500">
              <th className="pb-2.5 font-medium">Node Operator</th>
              <th className="pb-2.5 font-medium">Address / Identity</th>
              <th className="pb-2.5 font-medium">Region</th>
              <th className="pb-2.5 font-medium text-right">Participation</th>
              <th className="pb-2.5 font-medium text-right">24h Uptime</th>
              <th className="pb-2.5 font-medium text-right">Median Delta</th>
              <th className="pb-2.5 font-medium text-right">Last Slot</th>
              <th className="pb-2.5 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/50">
            {publishers.map((pub) => {
              const isCopied = copiedKey === pub.pubkey;

              return (
                <tr key={pub.id} className="hover:bg-[#13192b]/40 transition-colors">
                  <td className="py-2.5 pr-3 font-medium text-white">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span>{pub.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-zinc-400 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleCopy(pub.pubkey)}
                      className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Click to copy full public key"
                      aria-label={`Copy public key for ${pub.name}`}
                    >
                      <span>{formatKey(pub.pubkey)}</span>
                      <span className="text-[10px] text-zinc-600 hover:text-zinc-400">
                        {isCopied ? "[copied]" : "[copy]"}
                      </span>
                    </button>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="rounded bg-[#1e293b]/70 px-1.5 py-0.5 text-[10px] text-zinc-300 font-mono">
                      {pub.region}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-200">
                    {pub.slotsParticipated.toLocaleString()} slots
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-emerald-400 font-bold">
                    {pub.uptimePercent.toFixed(2)}%
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-300">
                    {pub.medianDeltaBps.toFixed(1)} bps
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-zinc-400 font-mono">
                    #{pub.lastSlot}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold ${
                        STATUS_BADGE[pub.status] ?? STATUS_BADGE.OFFLINE
                      }`}
                    >
                      {pub.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-[#1e293b]/60 pt-3 text-[10px] text-zinc-500">
        <div>
          <span>Quorum rule: Median of &ge; 3 independent feeds; outlier rejection threshold 150 bps.</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Staleness limit: 10 slots</span>
          <span>·</span>
          <span>SLA target: 99.5%</span>
        </div>
      </div>
    </div>
  );
}
