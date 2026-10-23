"use client";

import type { OracleFeed } from "../types";

interface FeedGridProps {
  feeds: OracleFeed[];
  selectedSymbol: string;
  onSelectFeed: (symbol: string) => void;
}

export function FeedGrid({ feeds, selectedSymbol, onSelectFeed }: FeedGridProps) {
  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0c101d] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#1e293b] px-4 py-2.5 bg-[#090d18]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Consensus Feed Grid
          </span>
          <span className="rounded bg-[#1e293b] px-1.5 py-0.2 font-mono text-[10px] text-zinc-400">
            {feeds.length} Active Feeds
          </span>
        </div>
        <span className="font-mono text-[11px] text-zinc-500">
          Zero-Copy Median Absolute Deviation (MAD)
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#1e293b] bg-[#080b14] text-[11px] text-zinc-400">
              <th className="py-2.5 px-4 font-medium">PAIR</th>
              <th className="py-2.5 px-4 font-medium text-right">PRICE (USD)</th>
              <th className="py-2.5 px-4 font-medium text-right">CONFIDENCE (±MAD)</th>
              <th className="py-2.5 px-4 font-medium text-center">STATUS FLAGS</th>
              <th className="py-2.5 px-4 font-medium text-center">QUORUM</th>
              <th className="py-2.5 px-4 font-medium text-right">SLOT</th>
              <th className="py-2.5 px-4 font-medium text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]/60">
            {feeds.map((feed) => {
              const isSelected = feed.symbol === selectedSymbol;
              const hasBigMove = feed.flagsList.includes("BIG_MOVE");
              const hasLowConf = feed.flagsList.includes("LOW_CONFIDENCE");
              const hasStale = feed.flagsList.includes("STALE");

              return (
                <tr
                  key={feed.symbol}
                  onClick={() => onSelectFeed(feed.symbol)}
                  className={`transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#141b2d] border-l-2 border-l-emerald-500"
                      : "hover:bg-[#101524]"
                  }`}
                >
                  <td className="py-3 px-4 font-semibold text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-200">{feed.symbol}</span>
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right font-medium tabular text-zinc-100">
                    ${feed.price < 2 ? feed.price.toFixed(4) : feed.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  <td className="py-3 px-4 text-right tabular">
                    <div className="inline-flex flex-col items-end">
                      <span className="text-zinc-300">
                        ±${feed.confidence < 0.01 ? feed.confidence.toFixed(6) : feed.confidence.toFixed(4)}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        ({feed.confidenceBps} bps)
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {hasBigMove && (
                        <span className="rounded bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          BIG_MOVE
                        </span>
                      )}
                      {hasLowConf && (
                        <span className="rounded bg-amber-950/70 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                          LOW_CONF
                        </span>
                      )}
                      {hasStale && (
                        <span className="rounded bg-rose-950/70 border border-rose-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">
                          STALE
                        </span>
                      )}
                      {!hasBigMove && !hasLowConf && !hasStale && (
                        <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-center">
                    <div className="inline-flex items-center gap-1.5">
                      <span className="tabular text-zinc-300 text-[11px]">
                        {feed.publishersCount}/{feed.totalPublishers}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: feed.totalPublishers }).map((_, i) => {
                          const active = (feed.publisherMask & (1 << i)) !== 0;
                          return (
                            <span
                              key={i}
                              className={`h-1.5 w-1.5 rounded-sm ${
                                active ? "bg-emerald-400" : "bg-zinc-700"
                              }`}
                              title={`Publisher #${i + 1}: ${active ? "active" : "offline"}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right tabular text-zinc-400 text-[11px]">
                    #{feed.slot.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFeed(feed.symbol);
                      }}
                      className={`rounded px-2 py-0.8 text-[10px] font-mono font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-300"
                          : "bg-[#182033] border-[#29354d] text-zinc-300 hover:border-zinc-400 hover:text-white"
                      }`}
                    >
                      {isSelected ? "INSPECTING" : "INSPECT"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
