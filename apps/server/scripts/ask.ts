// Ask the coach from the terminal, as Ask Coach would, and print the reply as it streams. Point
// STRIKE_DATA_DIR at a database (or a copy of a backup). Nothing runs in the background, so proposed
// changes are shown but never applied.
// Usage: node scripts/ask.ts "I missed my cook day"            (a new conversation)
//        node scripts/ask.ts --thread 3 "And tomorrow?"          (continue one)
//        node scripts/ask.ts --prompt "..."                      (print the prompt instead of asking)
import { chatPrompt, sendMessage } from "../src/coach/chat.ts";
import { runMigrations } from "../src/db/index.ts";
import { createThread, insertMessage } from "../src/services/coach-chat.ts";

runMigrations();
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const thread = flag("--thread");
const promptOnly = args.includes("--prompt");
const text = args.filter((a) => a !== "--prompt").join(" ").trim();
if (!text) {
  console.error('Usage: node scripts/ask.ts [--thread <id>] [--prompt] "message"');
  process.exit(1);
}

if (promptOnly) {
  const t = thread ? Number(thread) : createThread(text).id;
  insertMessage(t, "user", text, "done");
  console.log(chatPrompt(t, -1));
  process.exit(0);
}

const started = Date.now();
const { reply, start } = sendMessage({ threadId: thread ? Number(thread) : null, text });
console.error(`[thread ${start.thread.id}]`);
await new Promise<void>((resolve) => {
  reply.subscribe((e) => {
    const at = `${((Date.now() - started) / 1000).toFixed(1)}s`;
    if (e.type === "status") console.error(`\n[${at}] ${e.text}…`);
    else if (e.type === "delta") process.stdout.write(e.text);
    else if (e.type === "action") console.error(`\n[${at}] PROPOSED ${e.action.kind}: ${e.action.summary}${e.action.detail ? `\n    ${e.action.detail}` : ""}`);
    else if (e.type === "done") {
      console.error(`\n[${at}] ${e.reply.status}${e.reply.error ? `: ${e.reply.error}` : ""}`);
      resolve();
    }
  });
});
