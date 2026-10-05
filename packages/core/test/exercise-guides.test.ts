import { describe, expect, it } from "vitest";
import { EXERCISE_GUIDES, EXERCISES } from "../src/index.ts";

describe("exercise guides", () => {
  it("cover every exercise in the library, and nothing else", () => {
    expect(Object.keys(EXERCISE_GUIDES).sort()).toEqual(EXERCISES.map((e) => e.id).sort());
  });

  it.each(EXERCISES.map((e) => e.id))("%s has a complete guide", (id) => {
    const guide = EXERCISE_GUIDES[id]!;
    expect(guide.setup.length).toBeGreaterThanOrEqual(2);
    expect(guide.steps.length).toBeGreaterThanOrEqual(3);
    expect(guide.mistakes.length).toBeGreaterThanOrEqual(2);
    for (const line of [...guide.setup, ...guide.steps, ...guide.mistakes]) expect(line.trim()).toBe(line);
    expect(guide.video.youtubeId).toMatch(/^[\w-]{11}$/);
    expect(guide.video.start).toBeGreaterThanOrEqual(0);
    expect(guide.video.start).toBeLessThan(guide.video.seconds);
  });
});
