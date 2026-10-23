import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createMcpServer } from "../src/server.ts";

test("MCP Server Protocol & Tools", async (t) => {
  // Spin up temporary mock gateway for tool calls
  const server = http.createServer((req, res) => {
    if (req.url?.includes("/v2/feeds/BTC")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          symbol: "BTC/USD",
          price: 68420.5,
          confidence: 24.5,
          slot: 1492080,
          timestamp: 1729699200,
          flags: 0,
          flagsList: ["VALID"],
          publishersCount: 6,
          totalPublishers: 7,
        })
      );
      return;
    }

    if (req.url === "/v2/risk") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          signals: [
            { symbol: "BTC/USD", volatility15mBps: 48, volatility1hBps: 85, regime: "TRENDING_UP" },
          ],
        })
      );
      return;
    }

    if (req.url?.includes("/v2/provenance/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          slot: 1492080,
          provenanceVerified: true,
          ed25519SignatureQuorum: "VALID",
        })
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const mcp = createMcpServer({ gatewayUrl: `http://localhost:${port}` });

  await t.test("handles initialize handshake", async () => {
    const res = await mcp.handleMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    assert.equal(res.id, 1);
    assert.equal(res.result.serverInfo.name, "thru-quant-mcp");
    assert.equal(res.result.protocolVersion, "2024-11-05");
  });

  await t.test("handles tools/list query", async () => {
    const res = await mcp.handleMessage({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    assert.equal(res.id, 2);
    assert.equal(res.result.tools.length, 4);
    const names = res.result.tools.map((tool: any) => tool.name);
    assert.deepEqual(names, [
      "read_oracle_feed",
      "get_historical_twap",
      "get_risk_signals",
      "verify_slot_provenance",
    ]);
  });

  await t.test("executes read_oracle_feed tool call", async () => {
    const res = await mcp.handleMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "read_oracle_feed",
        arguments: { symbol: "BTC/USD" },
      },
    });
    assert.equal(res.id, 3);
    assert.ok(res.result.content[0].text);
    const data = JSON.parse(res.result.content[0].text);
    assert.equal(data.symbol, "BTC/USD");
    assert.equal(data.price, 68420.5);
    assert.equal(data.slot, 1492080);
  });

  await t.test("executes get_risk_signals tool call", async () => {
    const res = await mcp.handleMessage({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_risk_signals",
        arguments: { symbol: "BTC" },
      },
    });
    assert.equal(res.id, 4);
    const data = JSON.parse(res.result.content[0].text);
    assert.equal(data.symbol, "BTC/USD");
    assert.equal(data.regime, "TRENDING_UP");
  });

  await t.test("executes verify_slot_provenance tool call", async () => {
    const res = await mcp.handleMessage({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "verify_slot_provenance",
        arguments: { slot: 1492080 },
      },
    });
    assert.equal(res.id, 5);
    const data = JSON.parse(res.result.content[0].text);
    assert.equal(data.slot, 1492080);
    assert.equal(data.provenanceVerified, true);
  });

  server.close();
});
