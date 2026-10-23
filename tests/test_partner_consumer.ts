import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { OracleClient } from "../sdk/src/index.ts";

test("Design Partner: Lending health factor evaluation", async () => {
  const server = http.createServer((req, res) => {
    if (req.url?.includes("/v2/feeds/ETH")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "ETH/USD",
          price: 2600.0,
          confidence: 20.0,
          slot: 1492200,
          timestamp: Math.floor(Date.now() / 1000),
          flags: 0,
          flagsList: ["VALID"],
        })
      );
      return;
    }
    if (req.url?.includes("/v2/feeds/USDC")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "USDC/USD",
          price: 1.0,
          confidence: 0.002,
          slot: 1492200,
          timestamp: Math.floor(Date.now() / 1000),
          flags: 0,
          flagsList: ["VALID"],
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
  const ethVal = await client.calculateSafeValuation("ETH/USD", "collateral", { k: 1.0 });
  const usdcVal = await client.calculateSafeValuation("USDC/USD", "debt", { k: 1.0 });

  assert.equal(ethVal.safePrice, 2580.0);
  assert.equal(usdcVal.safePrice, 1.002);

  const collateralValue = 2 * ethVal.safePrice * 0.8;
  const debtValue = 3000 * usdcVal.safePrice;
  const healthFactor = collateralValue / debtValue;

  assert.ok(healthFactor > 1.37 && healthFactor < 1.38);
  assert.ok(healthFactor >= 1.05);

  server.close();
});

test("Design Partner: Perpetual DEX mark price clamping", async () => {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        symbol: "BTC/USD",
        price: 60000.0,
        confidence: 30.0,
        slot: 1492210,
        timestamp: Math.floor(Date.now() / 1000),
        flags: 0x01,
        flagsList: ["BIG_MOVE"],
      })
    );
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const client = new OracleClient({ daemonUrl: `http://localhost:${port}` });
  const quote = await client.getLatestPrice("BTC/USD");

  const maxPriceDelta = (quote.price * 300) / 10000;
  const orderBookMedian = 63000.0;
  const rawDelta = orderBookMedian - quote.price;
  const clampedDelta = Math.max(-maxPriceDelta, Math.min(rawDelta, maxPriceDelta));
  const markPrice = quote.price + clampedDelta;

  assert.equal(markPrice, 61800.0);
  assert.ok(quote.flagsList.includes("BIG_MOVE"));

  server.close();
});
