import { describe, expect, it } from "vitest";

import {
  createQuizRequestSchema,
  quizResponseSchema,
  quizTransitionRequestSchema,
  updateQuizRequestSchema,
} from "./quizzes.js";

const QUESTION_A = "0709fc76-9c2e-4322-bbeb-27f6ec8f844e";
const QUESTION_B = "6f5c3f0e-2f0d-4b8e-9a51-3c1d2a7e9b10";

describe("quiz contracts", () => {
  it("trims the title and accepts an optional time limit", () => {
    const parsed = createQuizRequestSchema.parse({
      title: "  Unit 3 vocabulary  ",
      timeLimitMinutes: 15,
      questionIds: [QUESTION_A, QUESTION_B],
    });

    expect(parsed.title).toBe("Unit 3 vocabulary");
    expect(parsed.timeLimitMinutes).toBe(15);
  });

  it("rejects duplicate, empty and oversized question selections", () => {
    expect(
      createQuizRequestSchema.safeParse({ title: "Quiz", questionIds: [QUESTION_A, QUESTION_A] })
        .success,
    ).toBe(false);
    expect(createQuizRequestSchema.safeParse({ title: "Quiz", questionIds: [] }).success).toBe(
      false,
    );
    expect(
      createQuizRequestSchema.safeParse({
        title: "Quiz",
        questionIds: [QUESTION_A],
        timeLimitMinutes: 0,
      }).success,
    ).toBe(false);
  });

  it("requires a version and at least one field for updates", () => {
    expect(updateQuizRequestSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateQuizRequestSchema.safeParse({ title: "Quiz" }).success).toBe(false);
    expect(updateQuizRequestSchema.safeParse({ title: "Quiz", version: 2 }).success).toBe(true);
    expect(quizTransitionRequestSchema.safeParse({ version: 0 }).success).toBe(false);
  });

  it("parses a published quiz detail with frozen items", () => {
    const now = "2026-10-12T08:00:00.000Z";
    const parsed = quizResponseSchema.parse({
      quiz: {
        id: "18ea5220-111c-4143-a108-5ed19cbf5f76",
        title: "Unit 3",
        description: null,
        timeLimitMinutes: null,
        status: "published",
        version: 3,
        questionCount: 1,
        publishedAt: now,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            position: 1,
            sourceQuestionId: null,
            sourceVersion: 2,
            type: "true_false",
            prompt: "Grammar appears in the text.",
            options: null,
            correctAnswer: "true",
            explanation: "It is in the first line.",
            difficulty: "easy",
          },
        ],
      },
    });

    expect(parsed.quiz.items[0]?.sourceQuestionId).toBeNull();
  });
});
