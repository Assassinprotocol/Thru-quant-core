"use client";

import { useEffect, useState, useRef } from "react";
import type { OracleFeed, RiskSignal, TelemetryStatus, PublisherOperator } from "./types";
import { createInitialFeeds, createInitialRiskSignals, createInitialPublishers } from "./mockData";
import { Header } from "./components/Header";
import { SloMetrics } from "./components/SloMetrics";
import { FeedGrid } from "./components/FeedGrid";
import { FeedDeepDive } from "./components/FeedDeepDive";
import { PublisherLeaderboard } from "./components/PublisherLeaderboard";
import { RiskMonitor } from "./components/RiskMonitor";
import { Playground } from "./components/Playground";

export default function Home() {
  const [feeds, setFeeds] = useState<OracleFeed[]>(() => createInitialFeeds());
  const [riskSignals, setRiskSignals] = useState<RiskSignal[]>(() => createInitialRiskSignals(feeds));
  const [publishers, setPublishers] = useState<PublisherOperator[]>(() => createInitialPublishers());
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC/USD");
  const [status, setStatus] = useState<TelemetryStatus>({
    connected: true,
    mode: "SIMULATED",
    slot: 1492084,
    lastUpdateTs: 1729699200,
    circuitBreakerActive: false,
    p99LatencyUs: 3.56,
    gatewayUrl: "http://localhost:8080",
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    async function attemptGatewaySync() {
      try {
        const res = await fetch(`${status.gatewayUrl}/v2/feeds`, {
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (Array.isArray(data.feeds) && data.feeds.length > 0) {
            setFeeds((prev) =>
              prev.map((feed) => {
                const live = data.feeds.find((f: any) => f.symbol === feed.symbol || f.symbol === feed.symbol.replace("/", ""));
                if (!live) return feed;
                const newPrice = Number(live.price);
                const newConf = Number(live.confidence);
                const newHistory = [
                  ...feed.history.slice(1),
                  {
                    slot: live.slot,
                    timestamp: Math.floor(Date.now() / 1000),
                    price: newPrice,
                    confidence: newConf,
                  },
                ];
                return {
                  ...feed,
                  price: newPrice,
                  confidence: newConf,
                  slot: live.slot,
                  flags: live.flags ?? 0,
                  flagsList: live.flagsList ?? ["VALID"],
                  history: newHistory,
                };
              })
            );

            setStatus((s) => ({
              ...s,
              connected: true,
              mode: "POLLING",
              slot: data.slot || s.slot + 1,
              lastUpdateTs: Math.floor(Date.now() / 1000),
            }));

            // Connect SSE for selected feed if not already connected
            if (!eventSourceRef.current && typeof window !== "undefined" && window.EventSource) {
              const symbolParam = selectedSymbol.replace("/", "");
              const es = new EventSource(`${status.gatewayUrl}/v2/feeds/${symbolParam}/stream`);
              es.onmessage = (event) => {
                try {
                  const update = JSON.parse(event.data);
                  setStatus((s) => ({ ...s, mode: "SSE" }));
                } catch {
                  // ignore parse error
                }
              };
              eventSourceRef.current = es;
            }

            try {
              const pubRes = await fetch(`${status.gatewayUrl}/v2/publishers`, {
                signal: AbortSignal.timeout(2000),
              });
              if (pubRes.ok && isSubscribed) {
                const pubData = await pubRes.json();
                if (Array.isArray(pubData.publishers) && pubData.publishers.length > 0) {
                  setPublishers(pubData.publishers);
                }
              }
            } catch {
              // Maintain local state if endpoint times out
            }
            return;
          }
        }
      } catch {
        // Gateway not reachable: operate in deterministic simulated live mode
        if (isSubscribed) {
          setStatus((s) => ({ ...s, mode: "SIMULATED" }));
        }
      }
    }

    attemptGatewaySync();
    const interval = setInterval(attemptGatewaySync, 5000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [status.gatewayUrl, selectedSymbol]);

  // Simulated micro-tick engine when gateway is offline or in simulated mode
  useEffect(() => {
    if (status.mode !== "SIMULATED") return;

    const tickInterval = setInterval(() => {
      setFeeds((prevFeeds) =>
        prevFeeds.map((feed) => {
          const isStable = ["USDC/USD", "USDT/USD", "DAI/USD"].includes(feed.symbol);
          const volatility = isStable ? 0.00005 : feed.symbol === "BTC/USD" ? 0.0008 : 0.0014;
          const delta = (Math.random() - 0.495) * volatility * feed.price;
          const newPrice = Number(Math.max(0.0001, feed.price + delta).toFixed(isStable ? 4 : 2));
          const newConf = Number((newPrice * (isStable ? 0.00008 : 0.0004 + Math.random() * 0.0006)).toFixed(isStable ? 6 : 4));
          const newSlot = feed.slot + 1;
          const now = Math.floor(Date.now() / 1000);

          const updatedHistory = [
            ...feed.history.slice(1),
            {
              slot: newSlot,
              timestamp: now,
              price: newPrice,
              confidence: newConf,
            },
          ];

          return {
            ...feed,
            price: newPrice,
            confidence: newConf,
            slot: newSlot,
            history: updatedHistory,
          };
        })
      );

      setStatus((s) => ({
        ...s,
        slot: s.slot + 1,
        lastUpdateTs: Math.floor(Date.now() / 1000),
      }));
    }, 2500);

    return () => clearInterval(tickInterval);
  }, [status.mode]);

  useEffect(() => {
    setRiskSignals(createInitialRiskSignals(feeds));
  }, [feeds]);

  const selectedFeed = feeds.find((f) => f.symbol === selectedSymbol) ?? feeds[0];

  const handleSimulateBreaker = () => {
    setStatus((s) => ({
      ...s,
      circuitBreakerActive: !s.circuitBreakerActive,
    }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07090e]">
      <Header
        status={status}
        onRefresh={() => setStatus((s) => ({ ...s, slot: s.slot + 1 }))}
        onGatewayUrlChange={(url) => setStatus((s) => ({ ...s, gatewayUrl: url }))}
        onSimulateBreaker={handleSimulateBreaker}
      />

      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full space-y-6">
        <SloMetrics status={status} />

        <FeedGrid
          feeds={feeds}
          selectedSymbol={selectedSymbol}
          onSelectFeed={(sym) => setSelectedSymbol(sym)}
        />

        <FeedDeepDive feed={selectedFeed} />

        <PublisherLeaderboard publishers={publishers} />

        <RiskMonitor signals={riskSignals} />

        <Playground selectedFeed={selectedFeed} />
      </main>

      <footer className="border-t border-[#1e293b] bg-[#0c101d] px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px] text-zinc-500">
          <div>
            <span>Thru Quant Core Hub</span> · <span>Sovereign Node v0.3.0</span> · <span>Zero External Telemetry</span>
          </div>
          <div>
            <span>Multi-Publisher Consensus Protocol (MAD Filter)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
