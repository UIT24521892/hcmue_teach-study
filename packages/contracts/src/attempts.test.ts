import { describe, expect, it } from "vitest";

import {
  attemptItemSchema,
  saveAttemptAnswersRequestSchema,
  submitAttemptRequestSchema,
} from "./attempts.js";

describe("attempt contracts", () => {
  it("trims responses and allows an empty string to clear an answer", () => {
    const parsed = saveAttemptAnswersRequestSchema.parse({
      answers: [
        { position: 1, response: "  daily  " },
        { position: 2, response: "" },
      ],
    });
    expect(parsed.answers.map((answer) => answer.response)).toEqual(["daily", ""]);
  });

  it("rejects duplicate positions and empty saves", () => {
    expect(
      saveAttemptAnswersRequestSchema.safeParse({
        answers: [
          { position: 1, response: "a" },
          { position: 1, response: "b" },
        ],
      }).success,
    ).toBe(false);
    expect(saveAttemptAnswersRequestSchema.safeParse({ answers: [] }).success).toBe(false);
    expect(submitAttemptRequestSchema.safeParse({}).success).toBe(true);
  });

  it("keeps the result slot nullable for in-progress items", () => {
    const item = attemptItemSchema.parse({
      position: 1,
      type: "true_false",
      prompt: "Grammar appears in the text.",
      options: null,
      difficulty: "easy",
      response: null,
      result: null,
    });
    expect(item.result).toBeNull();
    expect(item).not.toHaveProperty("correctAnswer");
  });
});
