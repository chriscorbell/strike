import type { Session, SessionExercise } from "@strike/core";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Switch } from "../../components/ui/Field.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { EmptyState, ErrorState, SkeletonList } from "../../components/ui/States.tsx";
import { cn } from "../../lib/cn.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { LOCATION_LABEL, MUSCLE_LABEL } from "../../lib/labels.ts";
import { keys } from "../../lib/queries.ts";
import { fmtRepRange, LOAD_TYPE_LABEL } from "./lib.ts";

interface SwapSheetProps {
  session: Session;
  exercise: SessionExercise | undefined;
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSwap: (exerciseId: string, permanent: boolean) => void;
}

export function SwapSheet({ session, exercise, open, pending, onClose, onSwap }: SwapSheetProps) {
  const [choice, setChoice] = useState<string | null>(null);
  const [permanent, setPermanent] = useState(false);
  const seId = exercise?.id ?? -1;

  useEffect(() => {
    if (open) {
      setChoice(null);
      setPermanent(false);
    }
  }, [open, seId]);

  const alternatives = useQuery({
    queryKey: [...keys.alternatives(session.id, seId), session.location],
    queryFn: () => endpoints.alternatives(session.id, seId),
    enabled: open && seId > 0,
    staleTime: 0,
  });

  const list = alternatives.data ?? [];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Swap exercise"
      description={exercise ? `Instead of ${exercise.name}` : undefined}
      footer={
        <div className="flex flex-col gap-4">
          <Switch
            checked={permanent}
            onChange={setPermanent}
            label="Use for the rest of this block"
            description={permanent ? "Future weeks use it too" : "Just this session"}
          />
          <Button
            variant="primary"
            size="lg"
            block
            icon={ArrowLeftRight}
            disabled={!choice}
            loading={pending}
            onClick={() => choice && onSwap(choice, permanent)}
          >
            Swap
          </Button>
        </div>
      }
    >
      {alternatives.isPending ? (
        <SkeletonList rows={4} rowClassName="h-14" />
      ) : alternatives.isError ? (
        <ErrorState error={alternatives.error} onRetry={() => void alternatives.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No alternatives">
          {exercise
            ? `Nothing else for ${MUSCLE_LABEL[exercise.muscle].toLowerCase()} fits your ${LOCATION_LABEL[session.location].toLowerCase()} equipment.`
            : null}
        </EmptyState>
      ) : (
        <ul className="-mx-2 flex flex-col gap-0.5" aria-label="Alternatives">
          {list.map((alt) => {
            const selected = choice === alt.id;
            return (
              <li key={alt.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setChoice(alt.id)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-accent-soft" : "hover:bg-raised",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[15px] font-medium", selected ? "text-accent" : "text-ink")}>{alt.name}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-3">
                      {LOAD_TYPE_LABEL[alt.loadType]} · {fmtRepRange(alt.repMin, alt.repMax)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full transition-colors",
                      selected ? "bg-accent text-accent-ink" : "ring-1 ring-line-strong ring-inset",
                    )}
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
