import { describe, expect, it } from "vitest";

import { generateValidatedQuestions, MockQuestionGenerationProvider } from "./question-provider.js";

describe("question generation providers", () => {
  it("creates a deterministic, schema-valid set with all MVP question types", async () => {
    const questions = await generateValidatedQuestions(new MockQuestionGenerationProvider(), {
      documentId: "document-1",
      sourceText: "Resilient learners practice every day. Small habits create progress.",
      targetQuestionCount: 3,
    });

    expect(questions.map((question) => question.type)).toEqual([
      "multiple_choice",
      "fill_blank",
      "true_false",
    ]);
    expect(questions[0]?.correctAnswer).toBe("Resilient");
  });

  it("rejects malformed provider output before persistence", async () => {
    await expect(
      generateValidatedQuestions(
        { name: "broken", generate: async () => [{ type: "multiple_choice" }] },
        { documentId: "document-1", sourceText: "Enough text", targetQuestionCount: 3 },
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_INVALID_OUTPUT" });
  });
});
