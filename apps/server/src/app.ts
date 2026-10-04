import fs from "node:fs";
import path from "node:path";
import { timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { z, ZodError, type ZodType } from "zod";
import {
  addDays,
  LocalDate,
  prepMomentFor,
  shoppingDateFor,
  Location,
  LogSetRequest,
  MealLogRequest,
  Measurements,
  MuscleFeedback,
  OnboardingRequest,
  Profile,
  TimeOfDay,
} from "@strike/core";
import { coachEnabled } from "./coach/claude.ts";
import { env } from "./env.ts";
import { HttpError } from "./http.ts";
import { addCoachNote, checkInDue, latestCheckIn, listCheckIns, runCheckIn } from "./services/checkins.ts";
import { enqueue, getJob, pendingJobRows, pendingJobs, recentJobs, toJob } from "./services/jobs.ts";
import { deleteMealLog, logMeal, mealHistory, menuRowById, menuRowFor, menuRowForWeek, planWeekStart, setDayOverride, setPlannedOption, toMenu } from "./services/meals.ts";
import { addMeasurements, onboard, state, updateProfile } from "./services/onboarding.ts";
import { requireProfile, today } from "./services/profile.ts";
import { dayView } from "./services/today.ts";
import * as training from "./services/training.ts";
import { deleteWeight, upsertWeight, weightsView } from "./services/weights.ts";
import { db, schema } from "./db/index.ts";
import { desc, eq } from "drizzle-orm";

const json = <T extends ZodType>(schema: T) =>
  zValidator("json", schema, (result, c) => {
    if (!result.success) return c.json({ error: "Invalid request.", details: result.error.issues }, 400);
  });

const id = (c: Context, name = "id") => {
  const n = Number(c.req.param(name));
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Bad ${name}.`);
  return n;
};

const date = (value: string | undefined) => {
  const parsed = LocalDate.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "Dates look like YYYY-MM-DD.");
  return parsed.data;
};

function tokenMatches(header: string | undefined) {
  if (!env.token) return true;
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(env.token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function createApp() {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status);
    if (err instanceof ZodError) return c.json({ error: "Invalid request.", details: err.issues }, 400);
    console.error(err);
    return c.json({ error: "Something went wrong on the server." }, 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true, version: env.version, coach: { configured: coachEnabled() } }));

  app.use("/api/*", async (c, next) => {
    if (!tokenMatches(c.req.header("authorization"))) return c.json({ error: "Unauthorized" }, 401);
    await next();
  });

  // Status and profile
  app.get("/api/state", (c) => c.json(state()));
  app.post("/api/onboarding", json(OnboardingRequest), (c) => c.json(onboard(c.req.valid("json"))));
  app.put("/api/profile", json(Profile), (c) => c.json(updateProfile(c.req.valid("json"))));

  // Today
  app.get("/api/today", (c) => c.json(dayView(c.req.query("date") ? date(c.req.query("date")) : undefined)));
  app.put("/api/days/:date/workout-time", json(z.object({ time: TimeOfDay.nullable() })), (c) => {
    const d = date(c.req.param("date"));
    setDayOverride(d, { workoutTime: c.req.valid("json").time });
    return c.json(dayView(d));
  });
  app.post("/api/days/:date/train", (c) => {
    const d = date(c.req.param("date"));
    setDayOverride(d, { dayType: "training" });
    return c.json(dayView(d));
  });
  app.post("/api/days/:date/rest", (c) => {
    const d = date(c.req.param("date"));
    setDayOverride(d, { dayType: "rest" });
    return c.json(dayView(d));
  });

  // Weight and measurements
  app.get("/api/weights", (c) => {
    const profile = requireProfile();
    const days = Math.min(3650, Math.max(7, Number(c.req.query("days") ?? 90) || 90));
    return c.json(weightsView(profile, today(profile), days));
  });
  app.post("/api/weights", json(z.object({ date: LocalDate, weightKg: z.number().min(30).max(300), source: z.enum(["manual", "healthkit"]) })), (c) => {
    const body = c.req.valid("json");
    upsertWeight(body.date, body.weightKg, body.source);
    const row = db.select().from(schema.weights).all().find((w) => w.date === body.date)!;
    return c.json({ date: row.date, weightKg: row.weightKg, source: row.source });
  });
  app.post("/api/weights/batch", json(z.object({ entries: z.array(z.object({ date: LocalDate, weightKg: z.number().min(30).max(300) })).max(400), source: z.literal("healthkit") })), (c) => {
    const { entries } = c.req.valid("json");
    let imported = 0;
    for (const e of entries) if (upsertWeight(e.date, e.weightKg, "healthkit")) imported++;
    return c.json({ imported });
  });
  app.delete("/api/weights/:date", (c) => {
    deleteWeight(date(c.req.param("date")));
    return c.json({ ok: true });
  });
  app.get("/api/measurements", (c) =>
    c.json(
      db
        .select()
        .from(schema.measurements)
        .orderBy(desc(schema.measurements.date), desc(schema.measurements.id))
        .all()
        .map((r) => ({ id: r.id, date: r.date, ...r.data })),
    ),
  );
  app.post("/api/measurements", json(Measurements.extend({ date: LocalDate })), (c) => {
    const { date: d, ...m } = c.req.valid("json");
    const row = addMeasurements(requireProfile(), d, m);
    return c.json({ id: row.id, date: row.date, ...row.data });
  });

  app.delete("/api/measurements/:id", (c) => {
    db.delete(schema.measurements).where(eq(schema.measurements.id, id(c))).run();
    return c.json({ ok: true });
  });

  // Training
  app.get("/api/meso", (c) => c.json(training.mesoOverview()));
  app.post("/api/meso/regenerate", json(z.object({ note: z.string().max(2000).optional() })), (c) => c.json(enqueue("mesocycle", { note: c.req.valid("json").note ?? null, reason: "Requested" })));
  app.get("/api/sessions", (c) => c.json(training.sessionSummaries(Math.min(200, Number(c.req.query("limit") ?? 30) || 30))));
  app.get("/api/sessions/:id", (c) => c.json(training.sessionView(id(c))));
  app.post("/api/sessions/:id/start", json(z.object({ location: Location.optional() })), (c) => c.json(training.startSession(id(c), c.req.valid("json").location)));
  app.post("/api/sessions/:id/location", json(z.object({ location: Location })), (c) => c.json(training.setLocation(id(c), c.req.valid("json").location)));
  app.get("/api/sessions/:id/exercises/:seId/alternatives", (c) => c.json(training.alternativesFor(id(c), id(c, "seId"))));
  app.post("/api/sessions/:id/exercises/:seId/swap", json(z.object({ exerciseId: z.string(), permanent: z.boolean() })), (c) => {
    const body = c.req.valid("json");
    return c.json(training.swapExercise(id(c), id(c, "seId"), body.exerciseId, body.permanent));
  });
  app.post("/api/sessions/:id/sets", json(LogSetRequest), (c) => c.json(training.logSet(id(c), c.req.valid("json"))));
  app.delete("/api/sessions/:id/sets/:setId", (c) => c.json(training.deleteSet(id(c), id(c, "setId"))));
  app.put("/api/sessions/:id/feedback", json(MuscleFeedback), (c) => c.json(training.putFeedback(id(c), c.req.valid("json"))));
  app.post("/api/sessions/:id/complete", (c) => c.json(training.completeSession(id(c))));
  app.post("/api/sessions/:id/skip", (c) => c.json(training.skipSession(id(c))));
  app.get("/api/exercises", (c) => c.json(training.listExercises(c.req.query("logged") === "1")));
  app.get("/api/exercises/:id/history", (c) => c.json(training.exerciseHistoryView(c.req.param("id"))));

  // Meals
  // ?week=next is the coming plan week (ready from the evening before shopping day); default this week.
  const weekParam = (value: string | undefined) => {
    const profile = requireProfile();
    const current = planWeekStart(profile, today(profile));
    if (value === "next") return addDays(current, 7);
    if (value == null || value === "current") return current;
    throw new HttpError(400, "week is current or next.");
  };
  app.get("/api/menu", (c) => {
    const week = weekParam(c.req.query("week"));
    const row = c.req.query("week") === "next" ? menuRowForWeek(week) : menuRowFor(week);
    const profile = requireProfile();
    // A plan job without a week was asked for the current one.
    const current = planWeekStart(profile, today(profile));
    const pending = pendingJobRows("meal_menu").find((j) => (typeof j.input.weekStart === "string" ? j.input.weekStart : current) === week);
    return c.json({
      menu: row ? toMenu(row) : null,
      pendingJob: pending ? toJob(pending) : null,
      prepAt: prepMomentFor(profile, week),
      shoppingDate: shoppingDateFor(profile, week),
    });
  });
  app.post("/api/menu/regenerate", json(z.object({ note: z.string().max(2000).optional(), week: z.enum(["current", "next"]).optional(), keepGroceries: z.boolean().optional() })), (c) => {
    const body = c.req.valid("json");
    return c.json(enqueue("meal_menu", { weekStart: weekParam(body.week), note: body.note ?? null, keepGroceries: body.keepGroceries ?? false, reason: "Requested" }));
  });
  app.get("/api/menus/:id", (c) => c.json(toMenu(menuRowById(id(c)))));
  app.post("/api/menu/:id/prep-guide", (c) => {
    const menu = menuRowById(id(c));
    if (!(menu.data.plan ?? []).length) throw new HttpError(409, "This menu has no day-by-day plan to prep from.");
    return c.json(enqueue("prep_guide", { menuId: menu.id }));
  });
  app.put("/api/menu/:id/plan", json(z.object({ date: LocalDate, slotIndex: z.number().int().min(0), optionId: z.string() })), (c) => {
    const body = c.req.valid("json");
    return c.json(setPlannedOption(id(c), body.date, body.slotIndex, body.optionId));
  });
  app.post("/api/meals/log", json(MealLogRequest), (c) => c.json(logMeal(c.req.valid("json"))));
  app.delete("/api/meals/log/:id", (c) => {
    deleteMealLog(id(c));
    return c.json({ ok: true });
  });
  app.get("/api/meals/history", (c) => c.json(mealHistory(Math.min(90, Math.max(1, Number(c.req.query("days") ?? 14) || 14)))));
  app.post("/api/meals/estimate", json(z.object({ description: z.string().min(2).max(1000) })), (c) => c.json(enqueue("estimate_meal", { description: c.req.valid("json").description })));
  app.post("/api/meals/more-options", json(z.object({ date: LocalDate, slotIndex: z.number().int().min(0) })), (c) => c.json(enqueue("more_options", c.req.valid("json"))));

  // Check-ins, notes and jobs
  app.get("/api/checkins", (c) => c.json(listCheckIns()));
  app.get("/api/checkins/status", (c) => c.json({ due: checkInDue(), latest: latestCheckIn() }));
  app.post("/api/checkins/run", json(z.object({ note: z.string().max(2000).optional() })), (c) => {
    // Running before check-in day is allowed: it records this plan week's check-in now.
    return c.json(runCheckIn(c.req.valid("json").note ?? null));
  });
  app.post("/api/coach/note", json(z.object({ note: z.string().min(1).max(2000) })), (c) => {
    addCoachNote(c.req.valid("json").note);
    return c.json({ ok: true });
  });
  app.get("/api/jobs", (c) => c.json(c.req.query("pending") ? pendingJobs() : recentJobs()));
  app.get("/api/jobs/:id", (c) => c.json(getJob(id(c))));

  app.all("/api/*", (c) => c.json({ error: "Not found." }, 404));

  // The web app, with client-side routes falling back to index.html.
  if (fs.existsSync(path.join(env.webDist, "index.html"))) {
    const root = path.relative(process.cwd(), env.webDist);
    app.use("/*", serveStatic({ root }));
    const index = fs.readFileSync(path.join(env.webDist, "index.html"), "utf8");
    // Client-side routes get the app; a missing file (a path with an extension) is a real 404.
    app.get("*", (c) => (/\.[a-z0-9]+$/i.test(c.req.path) ? c.text("Not found", 404) : c.html(index)));
  } else {
    app.get("/", (c) => c.text("Strike API. The web app isn't built; run `pnpm --filter @strike/web build`."));
  }

  return app;
}

