import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "react-router";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { useProfile, useUnits } from "../../lib/queries.ts";
import { useMediaQuery } from "../../lib/useMediaQuery.ts";
import { Lifts } from "./Lifts.tsx";
import { MeasurementsSection } from "./Measurements.tsx";
import { SessionsList } from "./SessionsList.tsx";
import { LogWeighIn, WeighInList } from "./WeighIns.tsx";
import { RangeControl, WeightChartPanel, WeightStats } from "./WeightOverview.tsx";
import { parseRange, useWeightRange, type RangeDays } from "./weightData.ts";

const TABS = [
  { value: "weight", label: "Weight" },
  { value: "body", label: "Body" },
  { value: "lifts", label: "Lifts" },
  { value: "sessions", label: "Sessions" },
] as const;

type Tab = (typeof TABS)[number]["value"];
const parseTab = (raw: string | null): Tab => TABS.find((t) => t.value === raw)?.value ?? "weight";

export function ProgressPage() {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"));
  const days = parseRange(params.get("range"));
  const units = useUnits();
  const { goal } = useProfile();
  const weights = useWeightRange(days);

  const setParam = (key: string, value: string | number) =>
    setParams(
      (p) => {
        p.set(key, String(value));
        return p;
      },
      { replace: true },
    );
  const setRange = (d: RangeDays) => setParam("range", d);

  const points = weights.data?.points;
  const loadingWeights = weights.isPending;

  if (desktop) {
    return (
      <Page wide>
        <PageHeader title="Progress" />
        <div className="space-y-14">
          <div>
            <Section title="Weight">
              <div className="grid grid-cols-12 gap-8">
                <WeightChartPanel
                  query={weights}
                  units={units}
                  goal={goal}
                  height={300}
                  className="col-span-8"
                  toolbar={<RangeControl value={days} onChange={setRange} />}
                />
                <WeightStats data={weights.data} loading={loadingWeights} units={units} goal={goal} layout="column" className="col-span-4 pt-1" />
              </div>
            </Section>
          </div>
          <div className="grid grid-cols-12 gap-x-10">
            <div className="col-span-5">
              <LogWeighIn points={points} />
              <Section title="Recent weigh-ins" className="mt-10">
                <WeighInList points={points} loading={loadingWeights} />
              </Section>
            </div>
            <div className="col-span-7">
              <MeasurementsSection />
            </div>
          </div>
          <div>
            <Section title="Lifts">
              <Lifts layout="split" />
            </Section>
          </div>
          <div>
            <Section title="Sessions">
              <SessionsList columns />
            </Section>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Progress" />
      <Segmented
        block
        options={TABS}
        value={tab}
        onChange={(t) => setParam("tab", t)}
        label="Progress section"
        className="mb-7"
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
        >
          {tab === "weight" && (
            <>
              <WeightStats data={weights.data} loading={loadingWeights} units={units} goal={goal} layout="row" />
              <WeightChartPanel
                query={weights}
                units={units}
                goal={goal}
                className="mt-6"
                footer={<RangeControl value={days} onChange={setRange} block />}
              />
              <LogWeighIn points={points} className="mt-4" />
              <Section title="Recent weigh-ins" className="mt-10">
                <WeighInList points={points} loading={loadingWeights} />
              </Section>
            </>
          )}
          {tab === "body" && <MeasurementsSection />}
          {tab === "lifts" && <Lifts layout="stack" />}
          {tab === "sessions" && <SessionsList />}
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}
