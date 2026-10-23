export type * from "./types.ts";
export * from "./db.ts";
export * from "./risk.ts";
export * from "./sync.ts";

import { MemoryDatabase, PgDatabase } from "./db.ts";
import { SyncEngine } from "./sync.ts";

export async function createIndexer(options: {
  databaseUrl?: string;
  network?: string;
  useMemory?: boolean;
}) {
  const network = options.network || "betanet";
  const db = options.useMemory || !options.databaseUrl
    ? new MemoryDatabase()
    : new PgDatabase(options.databaseUrl);

  await db.init();
  const engine = new SyncEngine(db, network);

  return { db, engine };
}
