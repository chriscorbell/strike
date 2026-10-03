import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { env } from "../env.ts";
import * as schema from "./schema.ts";

fs.mkdirSync(env.dataDir, { recursive: true });
export const sqlite = new Database(path.join(env.dataDir, "strike.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });
export type DB = typeof db;
export { schema };

export function runMigrations() {
  migrate(db, { migrationsFolder: env.migrations });
}

export function closeDb() {
  sqlite.close();
}
