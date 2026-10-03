import { desc, eq, lte } from "drizzle-orm";
import { ageOn, type BodyStats, type NutritionTargets, type Profile, todayIn } from "@strike/core";
import { db, schema } from "../db/index.ts";
import { HttpError } from "../http.ts";

export function getProfile(): Profile | null {
  return db.select().from(schema.profile).where(eq(schema.profile.id, 1)).get()?.data ?? null;
}

export function requireProfile(): Profile {
  const p = getProfile();
  if (!p) throw new HttpError(409, "Onboarding isn't finished yet.");
  return p;
}

export function onboardedAt(): string | null {
  return db.select().from(schema.profile).where(eq(schema.profile.id, 1)).get()?.onboardedAt ?? null;
}

export function saveProfile(data: Profile, onboarding: boolean) {
  const at = new Date().toISOString();
  const existing = db.select().from(schema.profile).where(eq(schema.profile.id, 1)).get();
  if (existing) {
    db.update(schema.profile)
      .set({ data, updatedAt: at, ...(onboarding ? { onboardedAt: at } : {}) })
      .where(eq(schema.profile.id, 1))
      .run();
  } else {
    db.insert(schema.profile).values({ id: 1, data, onboardedAt: at, updatedAt: at }).run();
  }
}

/** Today in the profile's time zone, or the server's when there is no profile yet. */
export function today(profile = getProfile()): string {
  return todayIn(profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function targetsOn(date: string): NutritionTargets | null {
  const row =
    db.select().from(schema.targets).where(lte(schema.targets.effectiveDate, date)).orderBy(desc(schema.targets.effectiveDate), desc(schema.targets.id)).get() ??
    db.select().from(schema.targets).orderBy(desc(schema.targets.id)).get();
  return row?.data ?? null;
}

export function saveTargets(t: NutritionTargets) {
  db.insert(schema.targets).values({ effectiveDate: t.effectiveDate, data: t }).run();
}

export function latestBodyFat(): number | null {
  const rows = db.select().from(schema.measurements).orderBy(desc(schema.measurements.date), desc(schema.measurements.id)).all();
  return rows.find((r) => r.data.bodyFatPercent != null)?.data.bodyFatPercent ?? null;
}

export function bodyStats(profile: Profile, weightKg: number, date: string): BodyStats {
  return {
    weightKg,
    heightCm: profile.heightCm,
    age: ageOn(profile.birthDate, date),
    sex: profile.sex,
    bodyFatPercent: latestBodyFat(),
  };
}
