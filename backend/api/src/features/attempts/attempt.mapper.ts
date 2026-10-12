import {
  attemptSchema,
  attemptSummarySchema,
  type Attempt,
  type AttemptSummary,
} from "@mach/contracts";

import { attemptItemRecordsSchema } from "./attempt.grading.js";
import type { AttemptRecord } from "./attempt.repository.js";

function baseFields(attempt: AttemptRecord) {
  return {
    id: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz.title,
    status: attempt.status === "SUBMITTED" ? "submitted" : "in_progress",
    totalCount: attempt.totalCount,
    answeredCount: attempt.answers.filter((answer) => answer.response.trim() !== "").length,
    correctCount: attempt.correctCount,
    score: attempt.score,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
  } as const;
}

export function toAttemptSummary(attempt: AttemptRecord): AttemptSummary {
  return attemptSummarySchema.parse(baseFields(attempt));
}

/**
 * Learner projection. Correct answers and explanations are attached only once
 * the attempt is submitted; an in-progress response never contains them.
 */
export function toAttempt(attempt: AttemptRecord, now: Date): Attempt {
  const submitted = attempt.status === "SUBMITTED";
  const answers = new Map(attempt.answers.map((answer) => [answer.position, answer]));
  const items = attemptItemRecordsSchema.parse(attempt.items).map((item) => {
    const answer = answers.get(item.position);
    return {
      position: item.position,
      type: item.type,
      prompt: item.prompt,
      options: item.options,
      difficulty: item.difficulty,
      response: answer?.response ?? null,
      result: submitted
        ? {
            correctAnswer: item.correctAnswer,
            explanation: item.explanation,
            isCorrect: answer?.isCorrect ?? false,
          }
        : null,
    };
  });
  return attemptSchema.parse({ ...baseFields(attempt), serverNow: now.toISOString(), items });
}
