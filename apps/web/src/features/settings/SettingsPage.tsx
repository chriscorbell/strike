import { ageOn, type Units } from "@strike/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, UserPen } from "lucide-react";
import { Link } from "react-router";
import { Page, PageHeader, Section } from "../../components/Page.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { getToken, setToken } from "../../lib/api.ts";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtBodyWeight, fmtHeight, fmtInt, fmtKcal, fmtPercent, fmtTime } from "../../lib/format.ts";
import { ACTIVITY_LABEL, GOAL_LABEL, LOCATION_LABEL, WEEKDAY_LONG, WEEKDAY_SHORT } from "../../lib/labels.ts";
import { useAppState, useApplyState, useServerToday } from "../../lib/queries.ts";
import { convertEquipment } from "../../lib/units.ts";

export function SettingsPage() {
  const { data: state } = useAppState();
  const today = useServerToday();
  const applyState = useApplyState();
  const qc = useQueryClient();
  const health = useQuery({ queryKey: ["health"], queryFn: endpoints.health, staleTime: 5 * 60_000 });
  const profile = state!.profile!;
  const targets = state!.targets;
  const hasToken = !!getToken();

  const setUnits = useMutation({
    mutationFn: (units: Units) =>
      endpoints.updateProfile({ ...profile, units, equipment: convertEquipment(profile.equipment, profile.units, units) }),
    onSuccess: (s) => {
      applyState(s);
      toast(s.profile?.units === "metric" ? "Using kg and cm" : "Using lb and inches");
    },
  });

  const signOut = () => {
    setToken(null);
    qc.clear();
    window.location.assign("/");
  };

  const g = profile.goal;
  const goalLine =
    g.type === "maintain"
      ? GOAL_LABEL.maintain
      : `${GOAL_LABEL[g.type]}, ${fmtPercent(g.ratePercentPerWeek, 2)} of body weight a week${g.targetWeightKg ? `, to ${fmtBodyWeight(g.targetWeightKg, profile.units)}` : ""}`;

  const rows: [string, string][] = [
    ["Age", `${ageOn(profile.birthDate, today)}`],
    ["Height", fmtHeight(profile.heightCm, profile.units)],
    ["Goal", goalLine],
    ["Activity", ACTIVITY_LABEL[profile.activityLevel].label],
    [
      "Training",
      `${profile.training.days.map((d) => WEEKDAY_SHORT[d] ?? "").join(", ")} at ${fmtTime(profile.training.workoutTime)}, ${profile.training.sessionMinutes} min, ${LOCATION_LABEL[profile.training.defaultLocation].toLowerCase()}`,
    ],
    ["Meals", `${profile.nutrition.mealsPerDay} a day, ${profile.nutrition.dietStyle}`],
    ["Check-in", WEEKDAY_LONG[profile.schedule.checkInDay] ?? ""],
  ];

  return (
    <Page>
      <PageHeader title="Settings" />

      <Section
        title={profile.name}
        action={
          <Link
            to="/settings/profile"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink"
          >
            <UserPen size={16} aria-hidden />
            Edit profile
          </Link>
        }
      >
        <dl className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 py-3 text-[15px]">
              <dt className="text-ink-3">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {targets && (
        <Section title="Daily targets" description={targets.reason}>
          <div className="grid grid-cols-2 gap-x-8">
            {(["training", "rest"] as const).map((type) => (
              <div key={type}>
                <h3 className="mb-1 text-sm font-medium text-ink-3">{type === "training" ? "Training days" : "Rest days"}</h3>
                <p className="tnum text-[22px] font-semibold tracking-tight text-ink">
                  {fmtKcal(targets[type].kcal)}
                  <span className="ml-1 text-sm font-normal text-ink-3">kcal</span>
                </p>
                <p className="tnum mt-1 text-[13px] text-ink-3">
                  {fmtInt(targets[type].proteinG)}P {fmtInt(targets[type].carbsG)}C {fmtInt(targets[type].fatG)}F
                </p>
                <p className="tnum mt-1 text-[13px] text-ink-3">Maintenance about {fmtKcal(targets.maintenanceKcal[type])}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Units">
        <Segmented
          label="Units"
          value={setUnits.isPending ? setUnits.variables : profile.units}
          onChange={(u) => u !== profile.units && setUnits.mutate(u)}
          disabled={setUnits.isPending}
          options={[
            { value: "imperial", label: "lb, in" },
            { value: "metric", label: "kg, cm" },
          ]}
        />
        <p className="mt-2 text-[13px] text-ink-3">Training loads and your equipment weights switch too.</p>
      </Section>

      <Section title="Server">
        <dl className="divide-y divide-line text-[15px]">
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-3">Coach</dt>
            <dd className="text-ink">{state!.coachAvailable ? "Connected" : "Offline, using templates"}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-3">Version</dt>
            <dd className="tnum text-ink">{health.data?.version ?? "-"}</dd>
          </div>
          <div className="flex justify-between gap-4 py-3">
            <dt className="text-ink-3">Access</dt>
            <dd className="text-ink">{hasToken ? "Token saved on this device" : "No token needed"}</dd>
          </div>
        </dl>
        {hasToken && (
          <Button variant="danger" icon={LogOut} className="mt-4" onClick={signOut}>
            Sign out
          </Button>
        )}
      </Section>
    </Page>
  );
}
