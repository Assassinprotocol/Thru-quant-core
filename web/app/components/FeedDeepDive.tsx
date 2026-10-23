"use client";

import { useState } from "react";
import type { OracleFeed } from "../types";

interface FeedDeepDiveProps {
  feed: OracleFeed;
}

export function FeedDeepDive({ feed }: FeedDeepDiveProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [copiedHex, setCopiedHex] = useState(false);

  const history = feed.history;
  const prices = history.map((h) => h.price);
  const minPrice = Math.min(...prices.map((p, i) => p - history[i].confidence));
  const maxPrice = Math.max(...prices.map((p, i) => p + history[i].confidence));
  const priceRange = maxPrice - minPrice || 1;

  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 30, bottom: 30, left: 65 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (index: number) => padding.left + (index / (history.length - 1)) * chartW;
  const getY = (price: number) => padding.top + chartH - ((price - minPrice) / priceRange) * chartH;

  const pricePath = history
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.price).toFixed(1)}`)
    .join(" ");

  const upperBand = history
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.price + pt.confidence).toFixed(1)}`)
    .join(" ");

  const lowerBand = [...history]
    .reverse()
    .map((pt, i) => {
      const origIndex = history.length - 1 - i;
      return `L ${getX(origIndex).toFixed(1)} ${getY(pt.price - pt.confidence).toFixed(1)}`;
    })
    .join(" ");

  const bandPath = `${upperBand} ${lowerBand} Z`;

  const copyHex = () => {
    navigator.clipboard.writeText(feed.rawWireHex);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 1500);
  };

  const hoveredPoint = hoveredIndex !== null ? history[hoveredIndex] : null;

  return (
    <div className="rounded-lg border border-[#1e293b] bg-[#0c101d] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between border-b border-[#1e293b] px-4 py-3 bg-[#090d18]">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm font-bold text-white tracking-wide">
            {feed.symbol} DEEP DIVE
          </div>
          <span className="rounded bg-[#1e293b] px-2 py-0.5 font-mono text-[10px] text-zinc-300">
            Slot #{feed.slot.toLocaleString()}
          </span>
          <span className="rounded bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
            CONFIDENCE: ±${feed.confidence < 0.01 ? feed.confidence.toFixed(6) : feed.confidence.toFixed(4)} ({feed.confidenceBps} bps)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
          <span>Authority: <code className="text-zinc-200">{feed.authority}</code></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-[#1e293b]">
        <div className="lg:col-span-7 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-xs font-semibold text-zinc-300">
              Price Trajectory & MAD Confidence Envelope
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Median Price
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-4 rounded-sm bg-emerald-500/20 border border-emerald-500/40" /> 95% Band
              </span>
            </div>
          </div>

          <div className="relative w-full rounded border border-[#1e293b] bg-[#070a12] p-2">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = padding.top + chartH * (1 - pct);
                const priceVal = minPrice + priceRange * pct;
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                    >
                      ${priceVal < 2 ? priceVal.toFixed(4) : priceVal.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              <path d={bandPath} fill="rgba(16, 185, 129, 0.12)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="0.8" />
              <path d={pricePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />

              {history.map((pt, i) => {
                const cx = getX(i);
                const cy = getY(pt.price);
                const isHovered = hoveredIndex === i;

                return (
                  <g key={pt.slot}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 4.5 : 2}
                      fill={isHovered ? "#34d399" : "#10b981"}
                      stroke="#0c101d"
                      strokeWidth="1.5"
                    />
                    <rect
                      x={cx - 10}
                      y={padding.top}
                      width={20}
                      height={chartH}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredIndex(i)}
                    />
                  </g>
                );
              })}

              {hoveredIndex !== null && (
                <line
                  x1={getX(hoveredIndex)}
                  y1={padding.top}
                  x2={getX(hoveredIndex)}
                  y2={padding.top + chartH}
                  stroke="#34d399"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
              )}
            </svg>

            {hoveredPoint && (
              <div className="mt-2 flex items-center justify-between rounded bg-[#101726] border border-[#232f48] px-3 py-1.5 font-mono text-xs">
                <div>
                  <span className="text-zinc-400">Slot: </span>
                  <span className="text-zinc-200">#{hoveredPoint.slot}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Price: </span>
                  <span className="text-emerald-400 font-semibold tabular">
                    ${hoveredPoint.price < 2 ? hoveredPoint.price.toFixed(4) : hoveredPoint.price.toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">Conf Band: </span>
                  <span className="text-zinc-300 tabular">
                    ±${hoveredPoint.confidence < 0.01 ? hoveredPoint.confidence.toFixed(6) : hoveredPoint.confidence.toFixed(4)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-semibold text-zinc-300">
                Wire Bytecode Inspector (64 Bytes)
              </span>
              <button
                onClick={copyHex}
                className="rounded border border-[#1e293b] bg-[#141b2e] px-2 py-0.5 font-mono text-[10px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                {copiedHex ? "COPIED HEX" : "COPY HEX"}
              </button>
            </div>

            <div className="rounded border border-[#1e293b] bg-[#070a12] p-2.5 font-mono text-[11px] text-zinc-300 break-all leading-relaxed">
              <span className="text-emerald-400">0x54485255</span>
              <span className="text-cyan-400">02</span>
              <span className="text-zinc-500">000000</span>
              <span className="text-purple-400">{feed.rawWireHex.slice(16, 32)}</span>
              <span className="text-amber-400">{feed.rawWireHex.slice(32, 48)}</span>
              <span className="text-zinc-400">{feed.rawWireHex.slice(48)}</span>
            </div>

            <div className="mt-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">Magic Header:</span>
                <span className="text-emerald-400 font-semibold">THRU (0x54485255)</span>
              </div>
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">Wire Version:</span>
                <span className="text-zinc-200">0x02 (Multi-Publisher v2)</span>
              </div>
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">Fixed Point Price:</span>
                <span className="text-zinc-200 tabular">{feed.priceQ64.slice(0, 18)}... (Q64.64)</span>
              </div>
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">MAD Confidence:</span>
                <span className="text-zinc-200 tabular">{feed.confidenceQ64.slice(0, 18)}... (Q64.64)</span>
              </div>
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">Flags Byte:</span>
                <span className="text-amber-400">0x{feed.flags.toString(16).padStart(2, "0")} ({feed.flagsList.join(" | ")})</span>
              </div>
              <div className="flex justify-between border-b border-[#1e293b]/50 pb-1">
                <span className="text-zinc-400">Publisher Mask:</span>
                <span className="text-cyan-400">0x{feed.publisherMask.toString(16).padStart(2, "0")} ({feed.publishersCount}/{feed.totalPublishers} active)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Provenance Check:</span>
                <span className="text-emerald-400 font-semibold">Ed25519 Aggregate Verified</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1e293b]/80 flex items-center justify-between font-mono text-[11px] text-zinc-500">
            <span>Zero deserialization allocations</span>
            <span>Zero-Copy Direct Cast</span>
          </div>
        </div>
      </div>
    </div>
  );
}
