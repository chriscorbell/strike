import type { Location, Session } from "@strike/core";
import { CalendarX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { LOCATION_ICON, LOCATION_LABEL } from "../../lib/labels.ts";
import { BackButton } from "./controls.tsx";

/** "Week 2 of 5 · 2 RIR", or "Deload week" in the deload. Weeks are 0-based on the wire. */
export function SessionMeta({ session, extra }: { session: Session; extra?: ReactNode }) {
  const deload = session.isDeload || session.week >= session.hardWeeks;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {deload ? (
        <Badge tone="outline">Deload week</Badge>
      ) : (
        <span className="tnum">
          Week {session.week + 1} of {session.hardWeeks}
        </span>
      )}
      <span aria-hidden>·</span>
      <span className="tnum">{session.targetRir} RIR</span>
      {extra}
    </span>
  );
}

interface SessionHeaderProps {
  session: Session;
  meta: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function SessionHeader({ session, meta, actions, children }: SessionHeaderProps) {
  return (
    <header className="mb-6 lg:mb-8">
      <div className="mb-3 flex h-11 items-center justify-between">
        <BackButton />
        {actions}
      </div>
      <div className="text-sm font-medium text-ink-3">{meta}</div>
      <h1 className="mt-1.5 text-[28px] font-semibold leading-[1.1] tracking-tight text-ink lg:text-[32px]">{session.label}</h1>
      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}


export function locationOptions(available: Location[]) {
  return available.map((l) => ({ value: l, label: LOCATION_LABEL[l], icon: LOCATION_ICON[l] }));
}

export function availableLocations(session: Session, equipment: { home: { available: boolean }; gym: { available: boolean } }) {
  return (["home", "gym"] as const).filter((l) => equipment[l].available || l === session.location);
}

export function SkipSheet({
  open,
  label,
  pending,
  onClose,
  onConfirm,
}: {
  open: boolean;
  label: string;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Skip ${label}?`}
      description="The plan moves on to the next session."
      footer={
        <div className="flex gap-2">
          <Button size="lg" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" className="flex-1" icon={CalendarX} loading={pending} onClick={onConfirm}>
            Skip workout
          </Button>
        </div>
      }
    >
      {null}
    </Sheet>
  );
}
