import type { CoachMessage } from "@strike/core";
import { ArrowDown, History, SquarePen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "../../components/ui/Button.tsx";
import { ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { easeOut, itemVariants, listVariants, pageVariants } from "../../lib/motion.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { Composer } from "./Composer.tsx";
import { HistorySheet } from "./HistorySheet.tsx";
import { ReplyMessage, UserMessage } from "./Messages.tsx";
import { useCoachChat, type CoachChat } from "./useCoachChat.ts";

const SUGGESTIONS = [
  "I missed my cook day",
  "Move today's workout to tomorrow",
  "Why did my weights change?",
  "Something lighter for dinner tonight",
];

/** Within this distance of the bottom, new text keeps the view pinned to it. */
const STICK_PX = 48;

/** Ask Coach: a conversation with the coach that can propose changes to the plan. */
export function CoachPage() {
  const chat = useCoachChat();
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const finePointer = useMediaQuery("(pointer: fine)");
  const scroll = useStickyScroll(chat.view);
  const composerRef = useToastOffset();

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chat.replying || chat.sending) return;
    scroll.toBottom();
    // A suggestion tap takes focus off the field; give it back on desktop.
    if (finePointer) inputRef.current?.focus({ preventScroll: true });
    const sent = await chat.send(chat.threadId, trimmed);
    if (sent) setDraft((d) => (d === text ? "" : d));
  };

  // Ready to type on desktop when a conversation opens; phones wait for a tap so the keyboard stays down.
  useEffect(() => {
    if (finePointer && !chat.loading) inputRef.current?.focus({ preventScroll: true });
  }, [chat.view, chat.loading, finePointer]);

  const empty = !chat.loading && !chat.error && chat.messages.length === 0;
  const fresh = chat.threadId == null && chat.messages.length === 0;

  return (
    <motion.main
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="flex h-[100dvh] flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      <div className={cn("shrink-0 border-b transition-colors duration-200", scroll.scrolled ? "border-line" : "border-transparent")}>
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 lg:px-10 lg:pb-4 lg:pt-9">
          <h1 className="text-[28px] font-semibold leading-[1.1] tracking-tight text-ink lg:text-[32px]">Coach</h1>
          <div className="-mr-2.5 flex items-center gap-1">
            <IconButton
              icon={SquarePen}
              label="New conversation"
              disabled={fresh && !chat.loading}
              onClick={() => {
                chat.reset();
                inputRef.current?.focus({ preventScroll: true });
              }}
            />
            <IconButton icon={History} label="History" onClick={() => setHistoryOpen(true)} />
          </div>
        </header>
      </div>

      <div ref={scroll.containerRef} onScroll={scroll.onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={scroll.contentRef} className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-10">
          {chat.loading ? (
            <ConversationSkeleton />
          ) : chat.error ? (
            <ErrorState error={chat.error} onRetry={chat.retry} />
          ) : empty ? (
            <EmptyConversation onPick={(s) => void send(s)} disabled={chat.sending} />
          ) : (
            <Conversation chat={chat} onRetry={(text) => void send(text)} />
          )}
        </div>
      </div>

      <div ref={composerRef} className="relative shrink-0">
        <AnimatePresence>
          {scroll.away && !chat.loading && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.94 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -top-14 left-1/2 -translate-x-1/2"
            >
              <IconButton
                icon={ArrowDown}
                label="Jump to latest"
                variant="secondary"
                className="rounded-full border border-line-strong shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
                onClick={scroll.toBottom}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mx-auto w-full max-w-3xl px-4 pb-3 pt-1 sm:px-6 lg:px-10 lg:pb-6">
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={() => void send(draft)}
            busy={chat.replying || chat.loading}
            sending={chat.sending}
            inputRef={inputRef}
          />
        </div>
      </div>

      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentId={chat.threadId}
        onOpen={(id) => {
          if (id !== chat.threadId) chat.open(id);
        }}
        onDeleted={(id) => {
          if (id === chat.threadId) chat.reset();
        }}
      />
    </motion.main>
  );
}

function Conversation({ chat, onRetry }: { chat: CoachChat; onRetry: (text: string) => void }) {
  const last = chat.messages.at(-1);

  return (
    <motion.div
      key={chat.view}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      role="log"
      aria-label="Conversation"
      aria-busy={chat.replying}
      className="flex flex-col gap-6"
    >
      {chat.messages.map((m, i) => (
        <motion.div
          key={m.id}
          initial={chat.shownIds.has(m.id) ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={easeOut}
        >
          {m.role === "user" ? (
            <UserMessage message={m} />
          ) : (
            <ReplyMessage
              message={m}
              status={m.status === "pending" ? chat.status : null}
              locked={chat.replying}
              onUpdate={chat.update}
              onRetry={m === last && m.status === "failed" ? retryFor(chat.messages, i, onRetry) : undefined}
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

/** "Try again" sends Chris's message before the failed reply as a new message. */
function retryFor(messages: CoachMessage[], index: number, send: (text: string) => void) {
  const asked = messages.slice(0, index).findLast((m) => m.role === "user");
  return asked ? () => send(asked.text) : undefined;
}

function EmptyConversation({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="mt-auto pt-10">
      <motion.h2
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={easeOut}
        className="text-[22px] font-semibold tracking-tight text-ink"
      >
        What's going on?
      </motion.h2>
      <motion.ul variants={listVariants} initial="initial" animate="animate" className="mt-4 flex flex-wrap gap-2" aria-label="Suggestions">
        {SUGGESTIONS.map((s) => (
          <motion.li key={s} variants={itemVariants}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className="inline-flex h-10 items-center rounded-full border border-line-strong px-4 text-sm font-medium text-ink-2 transition-[border-color,color,transform] duration-150 hover:border-ink-3/50 hover:text-ink active:scale-[0.97] disabled:opacity-40"
            >
              {s}
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="ml-auto h-11 w-3/5 rounded-2xl" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="ml-auto h-11 w-2/5 rounded-2xl" />
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-10/12" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

/**
 * Keeps the conversation pinned to its latest message as text streams in, unless the reader scrolled up.
 * `view` changes when another conversation opens, which always starts at the bottom.
 */
function useStickyScroll(view: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [scrolled, setScrolled] = useState(false);
  const [away, setAway] = useState(false);

  const toEnd = (smooth = false) => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  useLayoutEffect(() => {
    stick.current = true;
    toEnd();
  }, [view]);

  const measure = () => {
    const el = containerRef.current;
    if (!el) return null;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setScrolled(el.scrollTop > 4);
    setAway(!stick.current && fromBottom > 240);
    return fromBottom;
  };

  // Content grows as text streams and cards appear; the container shrinks as the composer grows.
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const observer = new ResizeObserver(() => {
      if (stick.current) toEnd();
      else measure();
    });
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Only scrolling up lets go of the bottom. A scroll event can arrive after more text has grown the page,
  // so being far from the bottom alone doesn't mean the reader left it.
  const lastTop = useRef(0);
  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const movedUp = el.scrollTop < lastTop.current - 1;
    lastTop.current = el.scrollTop;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (fromBottom < STICK_PX) stick.current = true;
    else if (movedUp) stick.current = false;
    measure();
  };

  return {
    containerRef,
    contentRef,
    onScroll,
    scrolled,
    away,
    /** Scroll to the latest message and follow it from there. */
    toBottom: () => {
      stick.current = true;
      toEnd(true);
    },
  };
}

/** Lift toasts above the composer while this page is open (the Toaster reads --toast-offset). */
function useToastOffset() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => {
      const h = el.offsetHeight;
      root.setProperty("--toast-offset", `calc(4rem + ${h + 8}px)`);
      root.setProperty("--toast-offset-lg", `${h + 4}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--toast-offset");
      root.removeProperty("--toast-offset-lg");
    };
  }, []);
  return ref;
}
