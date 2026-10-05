import type { CoachThreadSummary } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Button, IconButton } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { ErrorState, SkeletonList } from "../../components/ui/States.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtAgo } from "../../lib/format.ts";
import { itemVariants, listVariants } from "../../lib/motion.ts";
import { keys, useCoachThreads } from "../../lib/queries.ts";

interface HistorySheetProps {
  open: boolean;
  onClose: () => void;
  currentId: number | null;
  onOpen: (id: number) => void;
  onDeleted: (id: number) => void;
}

/** Earlier conversations: open one, or delete it. */
export function HistorySheet({ open, onClose, currentId, onOpen, onDeleted }: HistorySheetProps) {
  const threads = useCoachThreads(open);
  const [confirming, setConfirming] = useState<number | null>(null);

  useEffect(() => {
    if (open) setConfirming(null);
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Conversations">
      {threads.isPending ? (
        <SkeletonList rows={4} rowClassName="h-14" />
      ) : threads.isError ? (
        <ErrorState error={threads.error} onRetry={() => void threads.refetch()} className="py-4" />
      ) : threads.data.length === 0 ? (
        <p className="py-2 text-[15px] text-ink-3">No conversations yet.</p>
      ) : (
        <motion.ul variants={listVariants} initial="initial" animate="animate" className="-mx-2 flex flex-col gap-0.5">
          <AnimatePresence initial={false}>
            {threads.data.map((t) => (
              <motion.li key={t.id} variants={itemVariants} exit="exit" layout="position">
                <ThreadRow
                  thread={t}
                  current={t.id === currentId}
                  confirming={confirming === t.id}
                  onConfirm={(on) => setConfirming(on ? t.id : null)}
                  onOpen={() => {
                    onOpen(t.id);
                    onClose();
                  }}
                  onDeleted={() => onDeleted(t.id)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </Sheet>
  );
}

interface ThreadRowProps {
  thread: CoachThreadSummary;
  current: boolean;
  confirming: boolean;
  onConfirm: (on: boolean) => void;
  onOpen: () => void;
  onDeleted: () => void;
}

function ThreadRow({ thread, current, confirming, onConfirm, onOpen, onDeleted }: ThreadRowProps) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => endpoints.deleteCoachThread(thread.id),
    onSuccess: () => {
      qc.setQueryData<CoachThreadSummary[]>(keys.coachThreads, (list) => list?.filter((t) => t.id !== thread.id));
      toast("Conversation deleted");
      onDeleted();
    },
  });

  return (
    <AnimatePresence mode="wait" initial={false}>
      {confirming ? (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="group"
          aria-label={`Delete ${thread.title}?`}
          className="flex min-h-[3.75rem] flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-danger-soft px-3 py-2.5"
        >
          <p className="text-[15px] font-medium text-ink">Delete this conversation?</p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onConfirm(false)} disabled={remove.isPending} autoFocus>
              Cancel
            </Button>
            <Button size="sm" variant="danger" icon={Trash} loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="row"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn("group flex min-h-[3.75rem] items-center gap-1 rounded-xl pr-1 transition-colors", current ? "bg-raised" : "hover:bg-raised")}
        >
          <button
            type="button"
            onClick={onOpen}
            aria-current={current || undefined}
            className="min-w-0 flex-1 self-stretch rounded-xl px-3 py-2.5 text-left"
          >
            <span className={cn("line-clamp-2 text-[15px] leading-snug", current ? "font-medium text-ink" : "text-ink")}>{thread.title}</span>
            <span className="tnum mt-0.5 block text-[13px] text-ink-3">{fmtAgo(thread.updatedAt)}</span>
          </button>
          <IconButton icon={Trash} label={`Delete ${thread.title}`} size="sm" onClick={() => onConfirm(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
