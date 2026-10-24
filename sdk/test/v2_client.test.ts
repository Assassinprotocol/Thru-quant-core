import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { OracleClient } from "../src/client.ts";

test("OracleClient v2: getLatestPrice and calculateSafeValuation", async (t) => {
  // Spin up temporary mock Gateway v2
  const server = http.createServer((req, res) => {
    if (req.url === "/v2/feeds/BTC/USD") {
      if (req.headers["x-oracle-mode"] === "strict" && req.url.includes("stale")) {
        res.writeHead(412, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Feed is stale" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          price: 68000,
          confidence: 200,
          slot: 1492000,
          timestamp: 1729699200,
          flags: 0,
          flagsList: ["VALID"],
          publishersCount: 6,
          totalPublishers: 7,
        })
      );
      return;
    }

    if (req.url === "/v2/feeds/ETH/USD") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            symbolId: 2,
            symbol: "ETH/USD",
            price: 2500,
            priceRaw: "250000000000",
            confidenceBps: 10,
            publishSlot: "1492000",
            prevPublishSlot: "1491999",
            medianSourceTs: "1729699200",
            contributorCount: 6,
            flags: 0,
          },
        })
      );
      return;
    }

    if (req.url?.startsWith("/v2/feeds/BTC/USD/twap")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          symbolId: 1,
          twap: 68050.0,
          samples: 10,
          minPrice: 67900.0,
          maxPrice: 68200.0,
          currentPrice: 68000.0,
          publishSlot: "1492000",
        })
      );
      return;
    }

    if (req.url === "/v2/feeds/BTC/USD/attestation") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          symbolId: 1,
          publishSlot: "1492000",
          price: 68000.0,
          priceRaw: "6800000000000",
          confidenceBps: 20,
          wireSizeBytes: 88,
          binaryWireHex: "45454654",
          binaryWireBase64: "RUVERQ==",
          sha256: "abc123",
        })
      );
      return;
    }

    if (req.url?.startsWith("/v2/updates/price/latest")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          slot: "1492000",
          timestamp: 1729699200,
          symbols: ["BTC/USD", "ETH/USD"],
          count: 2,
          binary: {
            encoding: "hex",
            data: ["45454654", "45454654"],
            combinedHex: "4545465445454654",
            totalSizeBytes: 176,
            sha256: "feedbeef",
          },
          parsed: [
            { symbol: "BTC/USD", price: 68000, confidence: 200, slot: 1492000 },
            { symbol: "ETH/USD", price: 2500, confidence: 20, slot: 1492000 },
          ],
        })
      );
      return;
    }

    if (req.url?.startsWith("/v2/feeds/BTC/USD/benchmark")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          symbolId: 1,
          publishSlot: "1492000",
          price: 68000.0,
          priceRaw: "6800000000000",
          confidenceBps: 20,
          medianSourceTs: "1729699200",
          flags: 0,
          verified: true,
          source: "archive_aggregate",
        })
      );
      return;
    }

    if (req.url === "/v2/feeds/ETH/BTC") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          data: {
            symbol: "ETH/BTC",
            price: 0.03676,
            confidence: 0.0001,
            slot: 1492000,
          },
          derived: true,
          formula: "ETH/USD / BTC/USD",
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const client = new OracleClient({ daemonUrl: `http://localhost:${port}` });

  await t.test("getLatestPrice resolves live v2 feed accurately", async () => {
    const feed = await client.getLatestPrice("BTC/USD");
    assert.equal(feed.symbol, "BTC/USD");
    assert.equal(feed.price, 68000);
    assert.equal(feed.confidence, 200);
    assert.equal(feed.slot, 1492000);
    assert.deepEqual(feed.flagsList, ["VALID"]);
  });

  await t.test("getLatestPrice resolves nested { data: ... } gateway response accurately", async () => {
    const feed = await client.getLatestPrice("ETH/USD");
    assert.equal(feed.symbol, "ETH/USD");
    assert.equal(feed.price, 2500);
    assert.equal(feed.confidence, 2.5);
    assert.equal(feed.slot, 1492000);
    assert.equal(feed.publishersCount, 6);
  });

  await t.test("calculateSafeValuation applies asymmetric bounds", async () => {
    // Collateral valuation with k=1.0: P - k * conf = 68000 - 200 = 67800
    const collateral = await client.calculateSafeValuation("BTC/USD", "collateral", { k: 1.0 });
    assert.equal(collateral.safePrice, 67800);
    assert.equal(collateral.rawPrice, 68000);
    assert.equal(collateral.confidence, 200);

    // Debt valuation with k=1.5: P + k * conf = 68000 + 300 = 68300
    const debt = await client.calculateSafeValuation("BTC/USD", "debt", { k: 1.5 });
    assert.equal(debt.safePrice, 68300);
    assert.equal(debt.k, 1.5);
  });

  await t.test("watchFeed establishes subscription and closes cleanly", async () => {
    let received = false;
    const unsub = client.watchFeed("BTC/USD", (_update) => {
      received = true;
    });
    assert.equal(typeof unsub, "function");
    unsub();
    assert.equal(received, false);
  });

  await t.test("getTwap fetches canonical TWAP from daemon", async () => {
    const twap = await client.getTwap("BTC/USD", 10);
    assert.equal(twap.symbol, "BTC/USD");
    assert.equal(twap.twap, 68050.0);
    assert.equal(twap.samples, 10);
  });

  await t.test("getAttestation fetches binary wire payload and sha256", async () => {
    const att = await client.getAttestation("BTC/USD");
    assert.equal(att.symbol, "BTC/USD");
    assert.equal(att.wireSizeBytes, 88);
    assert.equal(att.binaryWireHex, "45454654");
  });

  await t.test("getLatestPriceUpdates fetches batched multi-feed updates", async () => {
    const batch = await client.getLatestPriceUpdates(["BTC", "ETH"]);
    assert.equal(batch.count, 2);
    assert.equal(batch.binary.data.length, 2);
    assert.equal(batch.binary.combinedHex, "4545465445454654");
    assert.equal(batch.parsed.length, 2);
  });

  await t.test("getBenchmarkPrice queries historical verified price by slot", async () => {
    const bench = await client.getBenchmarkPrice("BTC", 1492000);
    assert.equal(bench.symbol, "BTC/USD");
    assert.equal(bench.price, 68000.0);
    assert.equal(bench.verified, true);
  });

  await t.test("getCrossRate returns derived pair price", async () => {
    const cross = await client.getCrossRate("ETH", "BTC");
    assert.equal(cross.derived, true);
    assert.equal(cross.data.symbol, "ETH/BTC");
    assert.equal(cross.data.price, 0.03676);
  });

  await t.test("calculatePerpMarkPrice calculates clamped delta and funding rate", () => {
    const normal = client.calculatePerpMarkPrice(60000, 60100, 300);
    assert.equal(normal.markPrice, 60100);
    assert.equal(normal.isClamped, false);
    assert.ok(normal.fundingRate > 0);

    const clamped = client.calculatePerpMarkPrice(60000, 63000, 300);
    assert.equal(clamped.markPrice, 61800);
    assert.equal(clamped.isClamped, true);
  });

  await t.test("estimateComputeUnits produces deterministic gas estimates", () => {
    assert.equal(client.estimateComputeUnits(1), 6000);
    assert.equal(client.estimateComputeUnits(6), 18500);
  });

  await t.test("getLatestPriceUpdates throws on empty symbol array", async () => {
    await assert.rejects(async () => {
      await client.getLatestPriceUpdates([]);
    }, /symbols array must contain at least one symbol/);
  });

  await t.test("getBenchmarkPrice throws on invalid slot format", async () => {
    await assert.rejects(async () => {
      await client.getBenchmarkPrice("BTC", "invalid" as any);
    }, /Invalid slot parameter/);
  });

  await t.test("getCrossRate throws when base and quote are identical", async () => {
    await assert.rejects(async () => {
      await client.getCrossRate("BTC", "BTC");
    }, /Base and quote symbols must be distinct/);
  });

  await t.test("calculatePerpMarkPrice handles NaN and negative inputs safely", () => {
    const nanRes = client.calculatePerpMarkPrice(60000, NaN);
    assert.equal(nanRes.markPrice, 60000);
    assert.equal(nanRes.fundingRate, 0);
    assert.equal(nanRes.isClamped, false);

    const negRes = client.calculatePerpMarkPrice(60000, -100);
    assert.equal(negRes.markPrice, 60000);
    assert.equal(negRes.fundingRate, 0);
  });

  server.close();
});
