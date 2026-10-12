import type {
  Document as PrismaDocument,
  DocumentJob as PrismaDocumentJob,
  DocumentJobStatus as PrismaDocumentJobStatus,
  DocumentStatus as PrismaDocumentStatus,
  Question as PrismaQuestion,
  QuestionDifficulty as PrismaQuestionDifficulty,
  QuestionReviewStatus as PrismaQuestionReviewStatus,
  QuestionType as PrismaQuestionType,
} from "@prisma/client";

import {
  documentJobSchema,
  documentSchema,
  questionSchema,
  type Document,
  type DocumentJob,
  type Question,
} from "@mach/contracts";

const STATUS_MAP: Record<PrismaDocumentStatus, Document["status"]> = {
  UPLOADED: "uploaded",
  QUEUED: "queued",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
};

const JOB_STATUS_MAP: Record<PrismaDocumentJobStatus, DocumentJob["status"]> = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
};

const QUESTION_TYPE_MAP: Record<PrismaQuestionType, Question["type"]> = {
  MULTIPLE_CHOICE: "multiple_choice",
  FILL_BLANK: "fill_blank",
  TRUE_FALSE: "true_false",
};

const DIFFICULTY_MAP: Record<PrismaQuestionDifficulty, Question["difficulty"]> = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
};

const REVIEW_STATUS_MAP: Record<PrismaQuestionReviewStatus, Question["reviewStatus"]> = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REJECTED: "rejected",
};

/** Public projection deliberately excludes owner and private storage key. */
export function toDocument(prismaDocument: PrismaDocument): Document {
  return documentSchema.parse({
    id: prismaDocument.id,
    originalName: prismaDocument.originalName,
    extension: prismaDocument.extension,
    mimeType: prismaDocument.mimeType,
    byteSize: prismaDocument.byteSize,
    checksum: prismaDocument.checksum,
    status: STATUS_MAP[prismaDocument.status],
    characterCount: prismaDocument.characterCount,
    pageCount: prismaDocument.pageCount,
    processingError:
      prismaDocument.processingErrorCode && prismaDocument.processingErrorMessage
        ? {
            code: prismaDocument.processingErrorCode,
            message: prismaDocument.processingErrorMessage,
          }
        : null,
    createdAt: prismaDocument.createdAt.toISOString(),
    updatedAt: prismaDocument.updatedAt.toISOString(),
  });
}

export function toDocumentJob(job: PrismaDocumentJob): DocumentJob {
  return documentJobSchema.parse({
    id: job.id,
    documentId: job.documentId,
    status: JOB_STATUS_MAP[job.status],
    progress: job.progress,
    attempt: job.attempt,
    maxAttempts: job.maxAttempts,
    error:
      job.errorCode && job.errorMessage ? { code: job.errorCode, message: job.errorMessage } : null,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    updatedAt: job.updatedAt.toISOString(),
  });
}

export function toQuestion(question: PrismaQuestion): Question {
  return questionSchema.parse({
    id: question.id,
    documentId: question.documentId,
    type: QUESTION_TYPE_MAP[question.type],
    prompt: question.prompt,
    options: question.options,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    difficulty: DIFFICULTY_MAP[question.difficulty],
    reviewStatus: REVIEW_STATUS_MAP[question.reviewStatus],
    version: question.version,
    createdAt: question.createdAt.toISOString(),
    updatedAt: question.updatedAt.toISOString(),
  });
}
