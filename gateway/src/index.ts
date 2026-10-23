export * from "./types.ts";
export * from "./routes.ts";
export * from "./server.ts";

import { createGatewayServer } from "./server.ts";
import { MemoryDatabase, PgDatabase } from "@thru-quant/indexer";

export async function runGatewayDaemon() {
  const port = parseInt(process.env.PORT || "8080", 10);
  const host = process.env.HOST || "0.0.0.0";
  const dbUrl = process.env.DATABASE_URL;

  const db = dbUrl ? new PgDatabase(dbUrl) : new MemoryDatabase();
  await db.init();

  const server = await createGatewayServer({
    port,
    host,
    db,
  });

  await server.listen({ port, host });
  return server;
}
