import type { MealOption } from "@strike/core";
import { Check, ChefHat, Clock, Store } from "lucide-react";
import type { ReactNode } from "react";
import { MacroLine, MACRO_META } from "../../components/Macros.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Badge } from "../../components/ui/States.tsx";
import { Sheet } from "../../components/ui/Sheet.tsx";
import { cn } from "../../lib/cn.ts";
import { fmtInt, fmtKcal, fmtUsd } from "../../lib/format.ts";

/** Grab-and-go summaries are often just "From <place>.", which the place line already says. */
const restatesPlace = (o: MealOption) =>
  o.kind === "out" && !!o.place && o.summary.trim().replace(/\.$/, "").toLowerCase() === `from ${o.place.toLowerCase()}`;

/** Prep and cost in one quiet line. */
export function OptionMeta({ option, className }: { option: MealOption; className?: string }) {
  return (
    <span className={cn("tnum inline-flex items-center gap-2.5 text-[13px] text-ink-3", className)}>
      {option.kind === "home" ? (
        option.prepMinutes > 0 && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden />
            {option.prepMinutes} min
          </span>
        )
      ) : (
        option.place && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <Store size={12} className="shrink-0" aria-hidden />
            <span className="truncate">{option.place}</span>
          </span>
        )
      )}
      {option.costUsd > 0 && <span>{fmtUsd(option.costUsd)}</span>}
    </span>
  );
}

interface OptionRowProps {
  option: MealOption;
  onOpen: () => void;
  /** Right-side action, usually "Ate this". */
  action?: ReactNode;
  selected?: boolean;
}

/** A meal option as a tappable row: name, summary, macros, prep/cost. */
export function OptionRow({ option, onOpen, action, selected }: OptionRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <button
        type="button"
        onClick={onOpen}
        className="group min-w-0 flex-1 rounded-lg text-left focus-visible:outline-offset-4"
        aria-label={`${option.name}, details`}
      >
        <span className="flex items-center gap-2">
          <span className="line-clamp-2 text-[15px] font-medium leading-snug text-ink transition-colors group-hover:text-accent">{option.name}</span>
          {selected && <Check size={15} strokeWidth={2.5} className="shrink-0 text-accent" aria-label="Logged" />}
        </span>
        {option.summary && option.kind === "home" && (
          <span className="mt-0.5 line-clamp-1 block text-sm text-ink-3">{option.summary}</span>
        )}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <MacroLine macros={option.macros} />
          <OptionMeta option={option} />
        </span>
      </button>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </div>
  );
}

interface OptionSheetProps {
  option: MealOption | null;
  onClose: () => void;
  /** Primary action in the footer, e.g. "Ate this". */
  footer?: ReactNode;
  context?: string;
}

/** Full detail: ingredients and steps for home meals, place and exact order for grab-and-go. */
export function OptionSheet({ option, onClose, footer, context }: OptionSheetProps) {
  return (
    <Sheet
      open={!!option}
      onClose={onClose}
      title={option?.name ?? ""}
      description={
        option && (
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone="outline" icon={option.kind === "home" ? ChefHat : Store}>
              {option.kind === "home" ? "Home" : "Grab and go"}
            </Badge>
            {context && <span>{context}</span>}
          </span>
        )
      }
      footer={footer}
    >
      {option && (
        <div className="flex flex-col gap-6">
          {option.summary && !restatesPlace(option) && <p className="text-[15px] leading-relaxed text-ink-2">{option.summary}</p>}

          <dl className="grid grid-cols-4 gap-3">
            <div>
              <dt className="text-xs text-ink-3">Calories</dt>
              <dd className="tnum mt-0.5 text-lg font-semibold text-ink">{fmtKcal(option.macros.kcal)}</dd>
            </div>
            {MACRO_META.map((m) => (
              <div key={m.key}>
                <dt className="flex items-center gap-1.5 text-xs text-ink-3">
                  <span className="size-2 rounded-full" style={{ background: m.color }} aria-hidden />
                  {m.label}
                </dt>
                <dd className="tnum mt-0.5 text-lg font-semibold text-ink">
                  {fmtInt(option.macros[m.key])}
                  <span className="ml-0.5 text-sm font-normal text-ink-3">g</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
            {option.kind === "home" && option.prepMinutes > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={15} className="text-ink-3" aria-hidden />
                {option.prepMinutes} min prep
              </span>
            )}
            {option.costUsd > 0 && <span>About {fmtUsd(option.costUsd)}</span>}
          </div>

          {option.kind === "out" && (option.place || option.order) && (
            <div className="rounded-xl bg-raised p-4">
              {option.place && (
                <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                  <Store size={16} className="text-ink-3" aria-hidden />
                  {option.place}
                </p>
              )}
              {option.order && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{option.order}</p>}
            </div>
          )}

          {option.ingredients.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Ingredients</h3>
              <ul className="divide-y divide-line">
                {option.ingredients.map((ing, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-[15px]">
                    <span className="text-ink-2">{ing.item}</span>
                    <span className="tnum shrink-0 text-ink-3">{ing.amount}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {option.steps.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink">Steps</h3>
              <ol className="flex flex-col gap-3">
                {option.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                    <span className="tnum mt-px flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-semibold text-ink-2">
                      {i + 1}
                    </span>
                    <span className="min-w-0">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** "Ate this" for option rows: icon-only on phones, labeled from sm up. */
export function AteButton({ onClick, loading, label = "Ate this" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <Button size="sm" variant="outline" icon={Check} onClick={onClick} loading={loading} aria-label={label} title={label} className="max-sm:w-9 max-sm:px-0">
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
