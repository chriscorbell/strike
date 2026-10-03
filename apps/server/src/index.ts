import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { startBackups } from "./backup.ts";
import { registerCoachHandlers } from "./coach/tasks.ts";
import { closeDb, runMigrations } from "./db/index.ts";
import { env } from "./env.ts";
import { startScheduler, tick } from "./scheduler.ts";
import { onJobDone, startWorker, stopWorker } from "./services/jobs.ts";

runMigrations();
registerCoachHandlers();
// A finished job can unblock the next step, e.g. a new block or menu.
onJobDone(() => {
  try {
    tick();
  } catch (err) {
    console.error("[scheduler]", err);
  }
});
startWorker();
const timer = startScheduler();
const stopBackups = startBackups();

const server = serve({ fetch: createApp().fetch, port: env.port, hostname: env.host }, (info) => {
  console.log(`Strike ${env.version} listening on http://${info.address}:${info.port} (coach: ${env.coach}${env.token ? "" : ", no auth"})`);
});

function shutdown() {
  clearInterval(timer);
  stopBackups();
  stopWorker();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
