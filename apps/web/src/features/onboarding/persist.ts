// Onboarding progress survives a reload or a killed tab. Cleared once the profile is submitted.
import { ALL_STEPS, defaultDraft, type Draft, type StepId } from "./model.ts";

const KEY = "strike.onboarding.v1";

export interface SavedProgress {
  draft: Draft;
  step: StepId;
  furthest: number;
}

export function loadProgress(): SavedProgress | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedProgress> | null;
    if (!saved?.draft || typeof saved.draft !== "object" || !ALL_STEPS.includes(saved.step as StepId)) return null;
    const fresh = defaultDraft();
    return {
      draft: { ...fresh, ...saved.draft, timezone: saved.draft.timezone || fresh.timezone },
      step: saved.step as StepId,
      furthest: typeof saved.furthest === "number" ? saved.furthest : 0,
    };
  } catch {
    return null;
  }
}

export function saveProgress(progress: SavedProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage full or disabled: progress just won't survive a reload.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
