import { describe, expect, it } from "vitest";
import { calculateStreak, dateKey, parseDate, shiftDate } from "./dates";
import { quizzes, scoreQuiz } from "../features/demo/fixtures";

describe("local study dates", () => {
  it("uses calendar dates at midnight, not UTC strings", () => {
    expect(dateKey(new Date(2026, 8, 17, 0, 1))).toBe("2026-09-17");
    expect(dateKey(parseDate("2026-09-17"))).toBe("2026-09-17");
  });
  it("crosses month and year boundaries", () => {
    const today = new Date(2026, 0, 1);
    expect(dateKey(shiftDate(today, -1))).toBe("2025-12-31");
    expect(calculateStreak(["2026-01-01", "2025-12-31", "2025-12-30"], today)).toBe(3);
  });
  it("keeps yesterday's streak while today is unfinished and deduplicates sessions", () => {
    expect(calculateStreak(["2026-09-16", "2026-09-16", "2026-09-15"], new Date(2026, 8, 17))).toBe(
      2,
    );
    expect(calculateStreak(["2026-09-15"], new Date(2026, 8, 17))).toBe(0);
  });
  it("handles leap day and ignores future notes", () => {
    expect(
      calculateStreak(
        ["2024-03-01", "2024-02-29", "2024-02-28", "2024-03-02"],
        new Date(2024, 2, 1),
      ),
    ).toBe(3);
  });
});
describe("demo quiz scoring", () => {
  it("normalizes case and whitespace and counts missing answers as wrong", () => {
    const quiz = quizzes[1]!;
    expect(scoreQuiz(quiz, { v1: " have ", v2: "BY", v3: "True" })).toBe(100);
    expect(scoreQuiz(quiz, {})).toBe(0);
    expect(scoreQuiz(quiz, { v1: "have" })).toBe(33);
  });
});
