import path from "node:path";

const here = import.meta.dirname;

export const env = {
  port: Number(process.env.PORT ?? 3090),
  host: process.env.HOST ?? "0.0.0.0",
  dataDir: process.env.STRIKE_DATA_DIR ?? path.resolve(here, "../data"),
  /** Bearer token required on /api; unset disables auth (local development only). */
  token: process.env.STRIKE_TOKEN || null,
  /** claude: call Claude through the Agent SDK. mock: instant rule-based results. off: rule-based only. */
  coach: (process.env.STRIKE_COACH ?? "claude") as "claude" | "mock" | "off",
  model: process.env.STRIKE_MODEL ?? "claude-opus-5-5",
  /** Reasoning effort for every coach request. */
  effort: (process.env.STRIKE_EFFORT ?? "xhigh") as "low" | "medium" | "high" | "xhigh" | "max",
  webDist: process.env.STRIKE_WEB_DIST ?? path.resolve(here, "../../web/dist"),
  migrations: path.resolve(here, "../drizzle"),
  /** A second place for daily backups, such as a NAS share. */
  backupCopyDir: process.env.STRIKE_BACKUP_COPY_DIR || null,
  version: process.env.STRIKE_VERSION ?? "dev",
};
