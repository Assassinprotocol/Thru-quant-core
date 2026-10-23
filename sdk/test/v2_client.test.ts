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

  server.close();
});
