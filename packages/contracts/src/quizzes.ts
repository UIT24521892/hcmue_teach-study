import { z } from "zod";

import { paginationSchema, questionDifficultySchema, questionTypeSchema } from "./documents.js";

export const quizStatusSchema = z.enum(["draft", "published", "archived"]);

const quizTitleSchema = z.string().trim().min(1).max(160);
const quizDescriptionSchema = z.string().trim().max(2_000);
const timeLimitMinutesSchema = z.number().int().min(1).max(180);
const quizQuestionIdsSchema = z
  .array(z.string().uuid())
  .min(1)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Mỗi câu hỏi chỉ được chọn một lần trong quiz.",
  });

/**
 * Owner view of one quiz item, answers included. Draft items mirror the live
 * question; published items come from the snapshot frozen at publish time.
 */
export const quizItemSchema = z.object({
  position: z.number().int().positive(),
  sourceQuestionId: z.string().uuid().nullable(),
  sourceVersion: z.number().int().positive(),
  type: questionTypeSchema,
  prompt: z.string().min(1).max(2_000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6).nullable(),
  correctAnswer: z.string().min(1).max(1_000),
  explanation: z.string().min(1).max(4_000),
  difficulty: questionDifficultySchema,
});

export const quizSummarySchema = z.object({
  id: z.string().uuid(),
  title: quizTitleSchema,
  description: z.string().max(2_000).nullable(),
  timeLimitMinutes: timeLimitMinutesSchema.nullable(),
  status: quizStatusSchema,
  version: z.number().int().positive(),
  questionCount: z.number().int().nonnegative(),
  publishedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const quizDetailSchema = quizSummarySchema.extend({ items: z.array(quizItemSchema) });

export const createQuizRequestSchema = z.object({
  title: quizTitleSchema,
  description: quizDescriptionSchema.nullable().optional(),
  timeLimitMinutes: timeLimitMinutesSchema.nullable().optional(),
  questionIds: quizQuestionIdsSchema,
});

export const updateQuizRequestSchema = z
  .object({
    title: quizTitleSchema.optional(),
    description: quizDescriptionSchema.nullable().optional(),
    timeLimitMinutes: timeLimitMinutesSchema.nullable().optional(),
    questionIds: quizQuestionIdsSchema.optional(),
    version: z.number().int().positive(),
  })
  .refine(
    (input) =>
      input.title !== undefined ||
      input.description !== undefined ||
      input.timeLimitMinutes !== undefined ||
      input.questionIds !== undefined,
    { message: "Cần có ít nhất một trường quiz để cập nhật." },
  );

/** Body for state transitions (publish/archive) guarded by optimistic version. */
export const quizTransitionRequestSchema = z.object({ version: z.number().int().positive() });

export const quizResponseSchema = z.object({ quiz: quizDetailSchema });
export const listQuizzesResponseSchema = z.object({
  quizzes: z.array(quizSummarySchema),
  pagination: paginationSchema,
});

export type QuizStatus = z.infer<typeof quizStatusSchema>;
export type QuizItem = z.infer<typeof quizItemSchema>;
export type QuizSummary = z.infer<typeof quizSummarySchema>;
export type QuizDetail = z.infer<typeof quizDetailSchema>;
export type CreateQuizRequest = z.infer<typeof createQuizRequestSchema>;
export type UpdateQuizRequest = z.infer<typeof updateQuizRequestSchema>;
export type QuizTransitionRequest = z.infer<typeof quizTransitionRequestSchema>;
export type QuizResponse = z.infer<typeof quizResponseSchema>;
export type ListQuizzesResponse = z.infer<typeof listQuizzesResponseSchema>;
