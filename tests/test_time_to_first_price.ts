import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { OracleClient } from "../sdk/src/index.ts";

test("Benchmark: Time-to-first-price execution completes in < 500ms", async () => {
  const server = http.createServer((req, res) => {
    if (req.url?.includes("/v2/feeds/BTC")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          price: 68420.5,
          confidence: 25.0,
          slot: 1492100,
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

  const startMs = performance.now();
  const client = new OracleClient({ daemonUrl: `http://localhost:${port}` });
  const quote = await client.getLatestPrice("BTC/USD");
  const elapsedMs = performance.now() - startMs;

  assert.equal(quote.symbol, "BTC/USD");
  assert.equal(quote.price, 68420.5);
  assert.ok(elapsedMs < 500, `Time-to-first-price took ${elapsedMs}ms, expected < 500ms`);

  server.close();
});
