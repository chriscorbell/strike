// Small display helpers shared by the steps (kept out of component files so Fast Refresh works).
import type { Location } from "@strike/core";
import { Building, House, type LucideIcon } from "lucide-react";
import { LOCATION_LABEL } from "../../lib/labels.ts";

/** Weekdays in display order, Monday first. 0 = Sunday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const LOCATION_OPTIONS = [
  { value: "home", label: LOCATION_LABEL.home, icon: House },
  { value: "gym", label: LOCATION_LABEL.gym, icon: Building },
] as const satisfies readonly { value: Location; label: string; icon: LucideIcon }[];

/** "America/New_York" to "America/New York". */
export const tzLabel = (tz: string) => tz.replaceAll("_", " ");
