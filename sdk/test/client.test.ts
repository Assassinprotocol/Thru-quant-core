import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { OracleClient } from "../src/client.ts";

describe("OracleClient & Transport Security", () => {
  test("initializes with default localhost:8080 daemon port and pinned program ID", () => {
    const client = new OracleClient();
    assert.equal((client as any).daemonUrl, "http://localhost:8080");
    assert.equal(
      (client as any).programId,
      "taWLmuEWcY7nikkn1JB1Whl5nBG1YqWj0oKJMVL8bPbdfR"
    );
  });

  test("accepts custom programId and daemonUrl options", () => {
    const client = new OracleClient({
      daemonUrl: "http://127.0.0.1:9090",
      programId: "custom-program-id",
    });
    assert.equal((client as any).daemonUrl, "http://127.0.0.1:9090");
    assert.equal((client as any).programId, "custom-program-id");
  });
});
