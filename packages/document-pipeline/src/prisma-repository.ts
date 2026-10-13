import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type {
  DocumentPipelineJob,
  DocumentPipelineRepository,
  ExtractedDocument,
  GeneratedQuestion,
  SupportedDocumentExtension,
} from "./types.js";

const TYPE_MAP = {
  multiple_choice: "MULTIPLE_CHOICE",
  fill_blank: "FILL_BLANK",
  true_false: "TRUE_FALSE",
} as const;

const DIFFICULTY_MAP = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
} as const;

function toPipelineJob(input: {
  id: string;
  attempt: number;
  maxAttempts: number;
  document: {
    id: string;
    storageKey: string;
    originalName: string;
    extension: string;
    mimeType: string;
  };
}): DocumentPipelineJob {
  return {
    id: input.id,
    attempt: input.attempt,
    maxAttempts: input.maxAttempts,
    document: {
      ...input.document,
      extension: input.document.extension as SupportedDocumentExtension,
    },
  };
}

export function createPrismaDocumentPipelineRepository(
  prisma: PrismaClient,
): DocumentPipelineRepository {
  return {
    async claim(jobId) {
      return prisma.$transaction(async (transaction) => {
        const current = await transaction.documentJob.findUnique({
          where: { id: jobId },
          include: { document: true },
        });
        if (!current || current.status !== "QUEUED" || current.attempt >= current.maxAttempts) {
          return null;
        }

        const claimed = await transaction.documentJob.updateMany({
          where: { id: jobId, status: "QUEUED", attempt: current.attempt },
          data: {
            status: "PROCESSING",
            progress: Math.max(5, current.progress),
            attempt: { increment: 1 },
            startedAt: new Date(),
            completedAt: null,
            errorCode: null,
            errorMessage: null,
          },
        });
        if (claimed.count === 0) return null;

        await transaction.document.update({
          where: { id: current.documentId },
          data: {
            status: "PROCESSING",
            processingErrorCode: null,
            processingErrorMessage: null,
          },
        });
        return toPipelineJob({ ...current, attempt: current.attempt + 1 });
      });
    },

    async setProgress(jobId, progress) {
      await prisma.documentJob.updateMany({
        where: { id: jobId, status: "PROCESSING" },
        data: { progress: Math.max(0, Math.min(99, progress)) },
      });
    },

    async complete(job, extracted: ExtractedDocument, questions: GeneratedQuestion[]) {
      await prisma.$transaction(async (transaction) => {
        const completed = await transaction.documentJob.updateMany({
          where: { id: job.id, status: "PROCESSING", attempt: job.attempt },
          data: {
            status: "COMPLETED",
            progress: 100,
            activeKey: null,
            completedAt: new Date(),
            errorCode: null,
            errorMessage: null,
          },
        });
        if (completed.count === 0) return;

        await transaction.question.createMany({
          data: questions.map((question) => ({
            id: randomUUID(),
            documentId: job.document.id,
            generationJobId: job.id,
            type: TYPE_MAP[question.type],
            prompt: question.prompt,
            options:
              question.options === null
                ? Prisma.JsonNull
                : (question.options as Prisma.InputJsonValue),
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            difficulty: DIFFICULTY_MAP[question.difficulty],
          })),
        });
        await transaction.document.update({
          where: { id: job.document.id },
          data: {
            status: "READY",
            extractedText: extracted.text,
            characterCount: extracted.characterCount,
            pageCount: extracted.pageCount,
            processingErrorCode: null,
            processingErrorMessage: null,
          },
        });
      });
    },

    async fail(job, error) {
      const willRetry = error.retryable && job.attempt < job.maxAttempts;
      await prisma.$transaction(async (transaction) => {
        const failed = await transaction.documentJob.updateMany({
          where: { id: job.id, status: "PROCESSING", attempt: job.attempt },
          data: {
            status: willRetry ? "QUEUED" : "FAILED",
            ...(willRetry ? { progress: 0 } : {}),
            activeKey: willRetry ? job.document.id : null,
            completedAt: willRetry ? null : new Date(),
            errorCode: error.code,
            errorMessage: error.message,
          },
        });
        if (failed.count === 0) return;

        await transaction.document.update({
          where: { id: job.document.id },
          data: {
            status: willRetry ? "QUEUED" : "FAILED",
            processingErrorCode: error.code,
            processingErrorMessage: error.message,
          },
        });
      });
    },
  };
}
