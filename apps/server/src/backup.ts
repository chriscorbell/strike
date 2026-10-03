// Daily SQLite snapshots: kept in the data directory, and copied to the NAS share when it's mounted, so
// a lost disk doesn't take the history with it.
import fs from "node:fs";
import path from "node:path";
import { env } from "./env.ts";
import { sqlite } from "./db/index.ts";

const KEEP = 14;

function prune(dir: string) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^strike-\d{4}-\d{2}-\d{2}\.db$/.test(f))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - KEEP))) fs.rmSync(path.join(dir, f), { force: true });
}

export async function backupNow(): Promise<string> {
  const dir = path.join(env.dataDir, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `strike-${new Date().toISOString().slice(0, 10)}.db`);
  await sqlite.backup(file);
  prune(dir);
  if (env.backupCopyDir) {
    try {
      // Only copy when the share is really there: its parent must exist (the NAS automount is up).
      if (fs.existsSync(path.dirname(env.backupCopyDir))) {
        fs.mkdirSync(env.backupCopyDir, { recursive: true });
        fs.copyFileSync(file, path.join(env.backupCopyDir, path.basename(file)));
        prune(env.backupCopyDir);
      } else {
        console.warn(`[backup] ${env.backupCopyDir} isn't reachable; kept the local copy only.`);
      }
    } catch (err) {
      console.warn("[backup] copy failed:", err instanceof Error ? err.message : err);
    }
  }
  return file;
}

export function startBackups() {
  const run = () => backupNow().then((f) => console.log(`[backup] wrote ${f}`), (err) => console.error("[backup] failed:", err));
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, 24 * 60 * 60_000);
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
