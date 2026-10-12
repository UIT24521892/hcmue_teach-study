import { z } from "zod";

export const documentStatusSchema = z.enum(["uploaded", "queued", "processing", "ready", "failed"]);

export const processingErrorSchema = z.object({
  code: z.string().min(1).max(80),
  message: z.string().min(1).max(500),
});

export const documentSchema = z.object({
  id: z.string().min(1),
  originalName: z.string().min(1).max(180),
  extension: z.enum(["pdf", "docx", "txt", "jpg", "jpeg", "png", "webp"]),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  byteSize: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  status: documentStatusSchema,
  characterCount: z.number().int().nonnegative().nullable(),
  pageCount: z.number().int().positive().nullable(),
  processingError: processingErrorSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const documentJobStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);

export const documentJobSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  status: documentJobStatusSchema,
  progress: z.number().int().min(0).max(100),
  attempt: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  error: processingErrorSchema.nullable(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export const paginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative(),
});

export const uploadDocumentResponseSchema = z.object({
  document: documentSchema,
  job: documentJobSchema,
});
export const getDocumentResponseSchema = z.object({ document: documentSchema });
export const listDocumentsResponseSchema = z.object({
  documents: z.array(documentSchema),
  pagination: paginationSchema,
});
export const processDocumentResponseSchema = z.object({
  document: documentSchema,
  job: documentJobSchema,
});
export const listDocumentJobsResponseSchema = z.object({ jobs: z.array(documentJobSchema) });

export const questionTypeSchema = z.enum(["multiple_choice", "fill_blank", "true_false"]);
export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);
export const questionReviewStatusSchema = z.enum(["pending_review", "approved", "rejected"]);

export const questionSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  type: questionTypeSchema,
  prompt: z.string().min(1).max(2_000),
  options: z.array(z.string().min(1).max(500)).min(2).max(6).nullable(),
  correctAnswer: z.string().min(1).max(1_000),
  explanation: z.string().min(1).max(4_000),
  difficulty: questionDifficultySchema,
  reviewStatus: questionReviewStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateQuestionRequestSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2_000).optional(),
    options: z.array(z.string().trim().min(1).max(500)).min(2).max(6).nullable().optional(),
    correctAnswer: z.string().trim().min(1).max(1_000).optional(),
    explanation: z.string().trim().min(1).max(4_000).optional(),
    difficulty: questionDifficultySchema.optional(),
    version: z.number().int().positive(),
  })
  .refine(
    (input) =>
      input.prompt !== undefined ||
      input.options !== undefined ||
      input.correctAnswer !== undefined ||
      input.explanation !== undefined ||
      input.difficulty !== undefined,
    { message: "Cần có ít nhất một trường câu hỏi để cập nhật." },
  );

export const reviewQuestionRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  version: z.number().int().positive(),
});

export const questionResponseSchema = z.object({ question: questionSchema });
export const listQuestionsResponseSchema = z.object({
  questions: z.array(questionSchema),
  pagination: paginationSchema,
});

export type DocumentStatus = z.infer<typeof documentStatusSchema>;
export type Document = z.infer<typeof documentSchema>;
export type DocumentJob = z.infer<typeof documentJobSchema>;
export type DocumentJobStatus = z.infer<typeof documentJobStatusSchema>;
export type UploadDocumentResponse = z.infer<typeof uploadDocumentResponseSchema>;
export type GetDocumentResponse = z.infer<typeof getDocumentResponseSchema>;
export type ListDocumentsResponse = z.infer<typeof listDocumentsResponseSchema>;
export type ProcessDocumentResponse = z.infer<typeof processDocumentResponseSchema>;
export type ListDocumentJobsResponse = z.infer<typeof listDocumentJobsResponseSchema>;
export type Question = z.infer<typeof questionSchema>;
export type QuestionType = z.infer<typeof questionTypeSchema>;
export type QuestionDifficulty = z.infer<typeof questionDifficultySchema>;
export type QuestionReviewStatus = z.infer<typeof questionReviewStatusSchema>;
export type UpdateQuestionRequest = z.infer<typeof updateQuestionRequestSchema>;
export type ReviewQuestionRequest = z.infer<typeof reviewQuestionRequestSchema>;
export type QuestionResponse = z.infer<typeof questionResponseSchema>;
export type ListQuestionsResponse = z.infer<typeof listQuestionsResponseSchema>;
