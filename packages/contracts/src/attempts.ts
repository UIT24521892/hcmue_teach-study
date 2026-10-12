import { z } from "zod";

import { paginationSchema, questionDifficultySchema, questionTypeSchema } from "./documents.js";

export const attemptStatusSchema = z.enum(["in_progress", "submitted"]);

/** Revealed only after the attempt is submitted. */
export const attemptItemResultSchema = z.object({
  correctAnswer: z.string().min(1).max(1_000),
  explanation: z.string().min(1).max(4_000),
  isCorrect: z.boolean(),
});

/**
 * Learner view of one question. While the attempt is in progress `result` is
 * always null, so answers and explanations never reach the client early.
 */
export const attemptItemSchema = z.object({
  position: z.number().int().positive(),
  type: questionTypeSchema,
  prompt: z.string().min(1).max(2_000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6).nullable(),
  difficulty: questionDifficultySchema,
  response: z.string().max(1_000).nullable(),
  result: attemptItemResultSchema.nullable(),
});

const attemptBaseSchema = z.object({
  id: z.string().uuid(),
  quizId: z.string().uuid(),
  quizTitle: z.string().min(1).max(160),
  status: attemptStatusSchema,
  totalCount: z.number().int().positive(),
  answeredCount: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative().nullable(),
  score: z.number().int().min(0).max(100).nullable(),
  startedAt: z.string().datetime(),
  deadlineAt: z.string().datetime().nullable(),
  submittedAt: z.string().datetime().nullable(),
});

export const attemptSummarySchema = attemptBaseSchema;
export const attemptSchema = attemptBaseSchema.extend({
  /** Lets the client correct its countdown for clock skew. */
  serverNow: z.string().datetime(),
  items: z.array(attemptItemSchema).min(1),
});

export const attemptAnswerInputSchema = z.object({
  position: z.number().int().positive(),
  /** Empty string clears a saved response. */
  response: z.string().trim().max(1_000),
});

function attemptAnswersSchema(min: number) {
  return z
    .array(attemptAnswerInputSchema)
    .min(min)
    .max(50)
    .refine(
      (answers) => new Set(answers.map((answer) => answer.position)).size === answers.length,
      { message: "Mỗi câu chỉ được gửi một câu trả lời." },
    );
}

export const saveAttemptAnswersRequestSchema = z.object({ answers: attemptAnswersSchema(1) });
export const submitAttemptRequestSchema = z.object({
  answers: attemptAnswersSchema(0).optional(),
});

export const attemptResponseSchema = z.object({ attempt: attemptSchema });
export const listAttemptsResponseSchema = z.object({
  attempts: z.array(attemptSummarySchema),
  pagination: paginationSchema,
});

export type AttemptStatus = z.infer<typeof attemptStatusSchema>;
export type AttemptItem = z.infer<typeof attemptItemSchema>;
export type AttemptItemResult = z.infer<typeof attemptItemResultSchema>;
export type AttemptSummary = z.infer<typeof attemptSummarySchema>;
export type Attempt = z.infer<typeof attemptSchema>;
export type AttemptAnswerInput = z.infer<typeof attemptAnswerInputSchema>;
export type SaveAttemptAnswersRequest = z.infer<typeof saveAttemptAnswersRequestSchema>;
export type SubmitAttemptRequest = z.infer<typeof submitAttemptRequestSchema>;
export type AttemptResponse = z.infer<typeof attemptResponseSchema>;
export type ListAttemptsResponse = z.infer<typeof listAttemptsResponseSchema>;
