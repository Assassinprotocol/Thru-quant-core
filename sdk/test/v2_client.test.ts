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

  server.close();
});
