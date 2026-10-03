import type { TodayResponse } from "@strike/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Dumbbell } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Field, TextInput } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { toast } from "../../components/ui/Toast.tsx";
import { endpoints } from "../../lib/endpoints.ts";
import { fmtDate, fmtTime } from "../../lib/format.ts";
import { keys, useProfile } from "../../lib/queries.ts";

interface DaySheetProps {
  open: boolean;
  onClose: () => void;
  today: TodayResponse;
}

/** Move today's workout or switch the day between training and rest. */
export function DaySheet({ open, onClose, today }: DaySheetProps) {
  const qc = useQueryClient();
  const profile = useProfile();
  const workout = today.timeline.find((t) => t.kind === "workout");
  const currentTime = workout?.time ?? today.workoutTimeOverride ?? profile.training.workoutTime;
  const [time, setTime] = useState(currentTime);

  useEffect(() => {
    if (open) setTime(currentTime);
  }, [open, currentTime]);

  const apply = (res: TodayResponse) => {
    qc.setQueryData(keys.today(today.date), res);
    void qc.invalidateQueries({ queryKey: keys.meso });
  };

  const moveTime = useMutation({
    mutationFn: (t: string | null) => endpoints.setWorkoutTime(today.date, t),
    onSuccess: (res, t) => {
      apply(res);
      toast(t ? `Workout moved to ${fmtTime(t)}` : "Back to your usual time");
      onClose();
    },
  });

  const dayType = useMutation({
    mutationFn: (type: "training" | "rest") =>
      type === "training" ? endpoints.makeTrainingDay(today.date) : endpoints.makeRestDay(today.date),
    onSuccess: (res) => {
      apply(res);
      toast(res.dayType === "training" ? "Training day" : "Rest day");
    },
  });

  const isTraining = (dayType.isPending ? dayType.variables : today.dayType) === "training";

  return (
    <Sheet open={open} onClose={onClose} title="Adjust day" description={fmtDate(today.date)}>
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink-2" aria-hidden>
            Day type
          </span>
          <Segmented
            label="Day type"
            block
            value={isTraining ? "training" : "rest"}
            onChange={(v) => {
              if (v !== today.dayType) dayType.mutate(v);
            }}
            disabled={dayType.isPending}
            options={[
              { value: "training", label: "Training", icon: Dumbbell },
              { value: "rest", label: "Rest", icon: BedDouble },
            ]}
          />
          <p className="text-[13px] text-ink-3">
            {isTraining
              ? today.nextSession
                ? `${today.nextSession.label} is planned for today.`
                : "The next session is planned for today."
              : "The next session waits for your next training day."}
          </p>
        </div>

        {isTraining && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (time) moveTime.mutate(time);
            }}
            className="flex flex-col gap-3"
          >
            <Field label="Workout time" hint="Meal times move with it.">
              <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} className="tnum" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" loading={moveTime.isPending && moveTime.variables !== null} disabled={!time || time === currentTime}>
                Move workout
              </Button>
              {today.workoutTimeOverride && (
                <Button variant="ghost" loading={moveTime.isPending && moveTime.variables === null} onClick={() => moveTime.mutate(null)}>
                  Use usual time ({fmtTime(profile.training.workoutTime)})
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </Sheet>
  );
}
