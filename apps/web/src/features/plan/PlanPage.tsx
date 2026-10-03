import { Dumbbell, Hammer } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { CoachStatus } from "../../components/CoachStatus.tsx";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/States.tsx";
import { useMeso } from "../../lib/queries.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { BlockDays } from "./BlockDays.tsx";
import { BlockGrid } from "./BlockGrid.tsx";
import { BlockOverview, RegenerateSheet, RegenStatus } from "./BlockOverview.tsx";
import { CheckInDue, CheckInList } from "./CheckIns.tsx";
import { CoachNote } from "./CoachNote.tsx";
import { useRegenerate, type Regenerate } from "./useRegenerate.ts";

const TABS = [
  { value: "block", label: "Block" },
  { value: "checkins", label: "Check-ins" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export function PlanPage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "checkins" ? "checkins" : "block";
  const regen = useRegenerate();

  const checkIns = (
    <>
      <Section title="Check-ins">
        <CheckInList />
      </Section>
      <CoachNote />
    </>
  );

  if (desktop) {
    return (
      <Page wide>
        <PageHeader title="Plan" />
        <div className="grid grid-cols-12 gap-12">
          <div className="col-span-8 min-w-0">
            <Block regen={regen} />
          </div>
          <aside className="col-span-4 min-w-0" aria-label="Check-ins and notes">
            <CheckInDue className="mb-10" />
            {checkIns}
          </aside>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Plan" />
      <CheckInDue className="mb-6" />
      <Segmented
        block
        options={TABS}
        value={tab}
        onChange={(t) =>
          setParams(
            (p) => {
              p.set("tab", t);
              return p;
            },
            { replace: true },
          )
        }
        label="Plan section"
        className="mb-7"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        >
          {tab === "block" ? <Block regen={regen} /> : checkIns}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}

function Block({ regen }: { regen: Regenerate }) {
  const meso = useMeso();
  const [buildOpen, setBuildOpen] = useState(false);

  if (meso.isPending) return <BlockSkeleton />;
  if (meso.isError) return <ErrorState error={meso.error} onRetry={() => void meso.refetch()} />;

  if (!meso.data) {
    const building = regen.running && !regen.failed;
    return (
      <>
        <EmptyState
          icon={building ? Hammer : Dumbbell}
          title={building ? "Building your training block" : "No training block yet"}
          action={
            building ? (
              <CoachStatus className="mt-1" />
            ) : (
              !regen.failed && (
                <Button variant="primary" onClick={() => setBuildOpen(true)}>
                  Build block
                </Button>
              )
            )
          }
        >
          {building
            ? "Your coach is writing it around your training days and equipment. This page updates when it's ready."
            : "Your coach builds one around your training days and equipment."}
        </EmptyState>
        {regen.failed && <RegenStatus regen={regen} onRetry={() => setBuildOpen(true)} firstBlock />}
        <RegenerateSheet open={buildOpen} onClose={() => setBuildOpen(false)} regen={regen} firstBlock />
      </>
    );
  }

  return (
    <>
      <BlockOverview meso={meso.data} regen={regen} />
      <Section title="Schedule">
        <BlockGrid meso={meso.data} />
      </Section>
      <Section title="Training days">
        <BlockDays meso={meso.data} />
      </Section>
    </>
  );
}

function BlockSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your plan">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-4 w-40" />
      <Skeleton className="mt-5 h-4 w-full max-w-xl" />
      <Skeleton className="mt-2 h-4 w-4/5 max-w-lg" />
      <Skeleton className="mt-10 h-5 w-24" />
      <Skeleton className="mt-4 h-64" />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
