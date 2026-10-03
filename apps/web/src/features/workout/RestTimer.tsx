import { motion } from "motion/react";
import { useRef } from "react";
import { Panel } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtCountdown } from "../../lib/format.ts";
import { Dock } from "./controls.tsx";
import { useCountdown, type RestState, type RestTimer } from "./useRestTimer.ts";

interface RestTimerProps {
  timer: RestTimer;
  /** Called once when rest runs out while the screen is open. */
  onDone: () => void;
}

/** Keeps the last state around so the exit animation has something to show. */
function useLastRest(rest: RestState | null) {
  const last = useRef(rest);
  if (rest) last.current = rest;
  return last.current;
}

function Bar({ fraction }: { fraction: number }) {
  return (
    <div className="absolute inset-x-0 top-0 h-[3px] bg-line" aria-hidden>
      <div
        className="h-full origin-left bg-accent transition-transform duration-300 ease-linear"
        style={{ transform: `scaleX(${fraction})` }}
      />
    </div>
  );
}

function Clock({ remaining, done, className }: { remaining: number; done: boolean; className?: string }) {
  return (
    <motion.p
      key={done ? "done" : "running"}
      initial={done ? { scale: 0.9, opacity: 0.4 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={cn("origin-left font-mono font-medium leading-none tnum", done ? "text-accent" : "text-ink", className)}
    >
      {fmtCountdown(remaining)}
    </motion.p>
  );
}

function DockBody({ rest, timer, onDone }: RestTimerProps & { rest: RestState }) {
  const { remaining, done, fraction } = useCountdown(rest, onDone, timer.stop);
  return (
    <>
      <Bar fraction={fraction} />
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn("text-[13px] font-medium", done ? "text-accent" : "text-ink-3")}>{done ? "Rest over" : "Rest"}</p>
          <Clock remaining={remaining} done={done} className="mt-1 text-[28px]" />
        </div>
        {!done && (
          <>
            <Button size="md" variant="secondary" aria-label="15 seconds less" onClick={() => timer.adjust(-15)}>
              -15s
            </Button>
            <Button size="md" variant="secondary" aria-label="15 seconds more" onClick={() => timer.adjust(15)}>
              +15s
            </Button>
          </>
        )}
        <Button size="md" variant="ghost" onClick={timer.stop}>
          {done ? "Dismiss" : "Skip"}
        </Button>
      </div>
    </>
  );
}

/** Phones: slides up from the bottom edge. */
export function RestDock({ timer, onDone }: RestTimerProps) {
  const rest = useLastRest(timer.rest);
  return (
    <Dock show={!!timer.rest} label="Rest timer">
      {rest && <DockBody rest={rest} timer={timer} onDone={onDone} />}
    </Dock>
  );
}

/** Desktop: lives in the side rail. */
export function RestPanel({ timer, onDone }: RestTimerProps) {
  const rest = timer.rest;
  if (!rest) return null;
  return <PanelBody rest={rest} timer={timer} onDone={onDone} />;
}

function PanelBody({ rest, timer, onDone }: RestTimerProps & { rest: RestState }) {
  const { remaining, done, fraction } = useCountdown(rest, onDone, timer.stop);
  return (
    <Panel as="section" className="relative overflow-hidden p-5">
      <Bar fraction={fraction} />
      <p className={cn("text-sm font-medium", done ? "text-accent" : "text-ink-3")}>{done ? "Rest over" : "Rest"}</p>
      <Clock remaining={remaining} done={done} className="mt-2 text-[40px]" />
      <div className="mt-4 flex gap-2">
        {!done && (
          <>
            <Button size="md" variant="secondary" aria-label="15 seconds less" onClick={() => timer.adjust(-15)} className="flex-1">
              -15s
            </Button>
            <Button size="md" variant="secondary" aria-label="15 seconds more" onClick={() => timer.adjust(15)} className="flex-1">
              +15s
            </Button>
          </>
        )}
        <Button size="md" variant="ghost" onClick={timer.stop} className="flex-1">
          {done ? "Dismiss" : "Skip"}
        </Button>
      </div>
    </Panel>
  );
}
