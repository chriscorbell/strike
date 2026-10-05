import type { CoachMessage } from "@strike/core";
import { CircleAlert, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { WorkingGlyph } from "../../components/CoachStatus.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { ProposalCard } from "./ProposalCard.tsx";

export function UserMessage({ message }: { message: CoachMessage }) {
  return (
    <div className="flex justify-end pl-10 sm:pl-16">
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-accent-soft px-4 py-2.5 text-[15px] leading-relaxed text-ink">
        <span className="sr-only">You: </span>
        {message.text}
      </p>
    </div>
  );
}

interface ReplyProps {
  message: CoachMessage;
  /** What the coach is doing, for the reply being written. */
  status: string | null;
  /** Another reply is being written: proposals wait. */
  locked: boolean;
  onUpdate: (message: CoachMessage) => void;
  /** Ask again, on a failed reply. */
  onRetry?: () => void;
}

export function ReplyMessage({ message, status, locked, onUpdate, onRetry }: ReplyProps) {
  const pending = message.status === "pending";
  const statusText = pending ? (status ?? (message.text ? null : "Thinking")) : null;
  return (
    <div className="max-w-[68ch]">
      <span className="sr-only">Coach:</span>
      {message.text && <ReplyText text={message.text} streaming={pending} />}
      {message.actions.length > 0 && <ProposalCard message={message} locked={locked || pending} onUpdate={onUpdate} />}
      <AnimatePresence initial={false}>{statusText && <StatusLine key="status" text={statusText} spaced={!!message.text} />}</AnimatePresence>
      {message.status === "failed" && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="flex min-w-0 items-start gap-2 text-sm leading-snug text-ink-3">
            <CircleAlert size={16} className="mt-px shrink-0" aria-hidden />
            <span>{message.error ?? "The coach couldn't finish this reply."}</span>
          </p>
          {onRetry && (
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onRetry} className="-ml-2">
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/** "Reading the prep guide…" with a soft pulse, while no text has arrived since. */
function StatusLine({ text, spaced }: { text: string; spaced: boolean }) {
  return (
    <motion.div
      role="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className={spaced ? "mt-3" : undefined}
    >
      <div className="flex h-6 items-center gap-2.5 text-sm text-ink-3">
        <WorkingGlyph />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={text}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="animate-shimmer">{text}…</span>
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------- Reply text ----------

const BULLET = /^\s*- /;

/**
 * The coach writes plain text: paragraphs split on blank lines, "- " bullets and **bold**. Nothing else is
 * formatted. While streaming, an unclosed ** is shown bold so the markers don't flash.
 */
export function ReplyText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = text.trim().split(/\n[ \t]*\n/);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink">
      {blocks.map((block, i) => (
        <Block key={i} lines={block.split("\n")} open={streaming && i === blocks.length - 1} />
      ))}
    </div>
  );
}

function Block({ lines, open }: { lines: string[]; open: boolean }) {
  // Runs of bullet lines become lists; other runs become paragraphs with line breaks.
  const runs: { bullets: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const bullets = BULLET.test(line);
    const last = runs.at(-1);
    if (last && last.bullets === bullets) last.lines.push(line);
    else runs.push({ bullets, lines: [line] });
  }
  return (
    <>
      {runs.map((run, r) => {
        const isLastRun = r === runs.length - 1;
        if (run.bullets) {
          return (
            <ul key={r} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-3">
              {run.lines.map((line, i) => (
                <li key={i} className="pl-1">
                  {inline(line.replace(BULLET, ""), open && isLastRun && i === run.lines.length - 1)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={r}>
            {run.lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inline(line, open && isLastRun && i === run.lines.length - 1)}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

function inline(line: string, open: boolean): ReactNode[] {
  const parts = line.split("**");
  const balanced = parts.length % 2 === 1;
  return parts.map((part, i) => {
    if (i % 2 === 0) return part;
    // An unclosed ** at the end: still being written, or literal asterisks.
    if (!balanced && i === parts.length - 1 && !open) return `**${part}`;
    return (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    );
  });
}
