import { describe, expect, it } from "vitest";

import { gradeAttempt, isCorrectResponse, type AttemptItemRecord } from "./attempt.grading.js";

const base = { explanation: "Because.", difficulty: "easy", sourceVersion: 1 } as const;
const choice: AttemptItemRecord = {
  ...base,
  position: 1,
  type: "multiple_choice",
  prompt: "Pick one",
  options: ["Daily", "daily habits", "Never"],
  correctAnswer: "Daily",
};
const blank: AttemptItemRecord = {
  ...base,
  position: 2,
  type: "fill_blank",
  prompt: "____ habits help.",
  options: null,
  correctAnswer: "Daily",
};
const truth: AttemptItemRecord = {
  ...base,
  position: 3,
  type: "true_false",
  prompt: "It is true.",
  options: null,
  correctAnswer: "true",
};

describe("attempt grading", () => {
  it("is lenient with typed answers but exact for offered choices", () => {
    expect(isCorrectResponse(blank, "  daily ")).toBe(true);
    expect(isCorrectResponse(blank, "dai ly")).toBe(false);
    expect(isCorrectResponse(choice, "daily")).toBe(false);
    expect(isCorrectResponse(choice, "Daily")).toBe(true);
    expect(isCorrectResponse(truth, "TRUE")).toBe(false);
    expect(isCorrectResponse(truth, undefined)).toBe(false);
    expect(isCorrectResponse(blank, "   ")).toBe(false);
  });

  it("counts unanswered questions as wrong and rounds the score", () => {
    const graded = gradeAttempt(
      [choice, blank, truth],
      new Map([
        [1, "Daily"],
        [2, "daily"],
      ]),
    );
    expect(graded.correctCount).toBe(2);
    expect(graded.score).toBe(67);
    expect(graded.correctness.get(3)).toBe(false);
  });
});
