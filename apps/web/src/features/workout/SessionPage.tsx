import type { CompleteSessionResponse } from "@strike/core";
import { Dumbbell, House } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Page } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { ApiError } from "../../lib/api.ts";
import { cn } from "../../lib/cn.ts";
import { useSession } from "../../lib/queries.ts";
import { BackButton } from "./controls.tsx";
import { HistoryView } from "./HistoryView.tsx";
import { StartView } from "./StartView.tsx";
import { SummaryView } from "./SummaryView.tsx";
import { clearRestTimer } from "./useRestTimer.ts";
import { useSessionActions } from "./useSessionActions.ts";
import { WorkoutView } from "./WorkoutView.tsx";

/** /sessions/:id. Planned sessions start here, in-progress ones are logged here, finished ones are read-only. */
export function SessionPage() {
  const { id: raw } = useParams();
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return <NotFound />;
  // Keyed so local state (selection, summary, sheets) never leaks between sessions.
  return <SessionScreen key={id} id={id} />;
}

function SessionScreen({ id }: { id: number }) {
  const query = useSession(id);
  const [summary, setSummary] = useState<CompleteSessionResponse["summary"] | null>(null);
  const actions = useSessionActions(id, {
    onCompleted: (res) => {
      clearRestTimer(id);
      setSummary(res.summary);
    },
  });

  const session = query.data;
  if (!session) {
    if (query.isError) {
      if (query.error instanceof ApiError && query.error.status === 404) return <NotFound />;
      return (
        <Page>
          <div className="mb-3 flex h-11 items-center">
            <BackButton />
          </div>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Page>
      );
    }
    return <SessionSkeleton />;
  }

  if (summary && session.status === "completed") return <SummaryView session={session} summary={summary} actions={actions} />;
  if (session.status === "planned") return <StartView session={session} actions={actions} />;
  if (session.status === "in_progress") return <WorkoutView session={session} actions={actions} />;
  return <HistoryView session={session} />;
}

function NotFound() {
  const navigate = useNavigate();
  return (
    <Page>
      <div className="mb-3 flex h-11 items-center">
        <BackButton />
      </div>
      <EmptyState
        icon={Dumbbell}
        title="Workout not found"
        action={
          <Button icon={House} onClick={() => void navigate("/")}>
            Back to Today
          </Button>
        }
      />
    </Page>
  );
}

function SessionSkeleton() {
  return (
    <Page wide>
      <div role="status" aria-label="Loading workout" className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10 xl:gap-14">
        <div className="min-w-0">
          <div className="mb-3 flex h-11 items-center">
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-8 w-44" />
          <Shimmer className="mt-5 h-11 w-44 rounded-full" />
          <div className="mt-8 flex flex-col gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="mt-2.5 h-4 w-32" />
                  <Skeleton className="mt-4 h-4 w-full max-w-md" />
                </div>
                <div className="divide-y divide-line border-t border-line">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="flex h-14 items-center gap-3 px-4 sm:px-5">
                      <Shimmer className="size-8 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="ml-auto h-4 w-12" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <Shimmer className="h-72 rounded-2xl" />
        </div>
      </div>
    </Page>
  );
}

/** Skeleton block for shapes the shared Skeleton's rounded-xl can't be overridden into. */
function Shimmer({ className }: { className: string }) {
  return <div aria-hidden className={cn("animate-shimmer bg-raised", className)} />;
}
