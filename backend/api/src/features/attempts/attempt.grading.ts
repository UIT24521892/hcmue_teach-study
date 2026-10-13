import { z } from "zod";

import { quizItemSchema } from "@mach/contracts";

/** Question content frozen into `quiz_attempts.items` when the attempt starts. */
export const attemptItemRecordSchema = quizItemSchema.omit({ sourceQuestionId: true });
export const attemptItemRecordsSchema = z.array(attemptItemRecordSchema).min(1);
export type AttemptItemRecord = z.infer<typeof attemptItemRecordSchema>;

/**
 * Lenient comparison for typed answers: case, surrounding/duplicate spaces and
 * Unicode composition differences are not counted as mistakes.
 */
export function normalizeResponse(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function isCorrectResponse(item: AttemptItemRecord, response: string | undefined): boolean {
  if (response === undefined || response.trim() === "") return false;
  if (item.type === "fill_blank") {
    return normalizeResponse(response) === normalizeResponse(item.correctAnswer);
  }
  // Choices and true/false must match an offered value exactly.
  return response === item.correctAnswer;
}

export interface GradedAttempt {
  correctness: Map<number, boolean>;
  correctCount: number;
  score: number;
}

export function gradeAttempt(
  items: AttemptItemRecord[],
  responses: Map<number, string>,
): GradedAttempt {
  const correctness = new Map<number, boolean>();
  for (const item of items) {
    correctness.set(item.position, isCorrectResponse(item, responses.get(item.position)));
  }
  const correctCount = [...correctness.values()].filter(Boolean).length;
  return {
    correctness,
    correctCount,
    score: Math.round((correctCount / items.length) * 100),
  };
}
