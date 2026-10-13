import { randomUUID } from "node:crypto";

import { Prisma, type Document, type DocumentJob } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export class AiQuotaExceededError extends Error {}

export const documentJobRepository = {
  findOwnedDocument(documentId: string, ownerId: string): Promise<Document | null> {
    return prisma.document.findFirst({ where: { id: documentId, ownerId, deletedAt: null } });
  },

  findActive(documentId: string): Promise<DocumentJob | null> {
    return prisma.documentJob.findUnique({ where: { activeKey: documentId } });
  },

  countOwnerJobsSince(ownerId: string, since: Date): Promise<number> {
    return prisma.documentJob.count({
      where: { createdAt: { gte: since }, document: { ownerId, deletedAt: null } },
    });
  },

  async createQueued(
    documentId: string,
    ownerId: string,
    maxAttempts: number,
    quota: number,
    since: Date,
  ): Promise<DocumentJob> {
    for (let transactionAttempt = 1; transactionAttempt <= 3; transactionAttempt += 1) {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            const used = await transaction.documentJob.count({
              where: { createdAt: { gte: since }, document: { ownerId, deletedAt: null } },
            });
            if (used >= quota) throw new AiQuotaExceededError();

            const job = await transaction.documentJob.create({
              data: {
                id: randomUUID(),
                documentId,
                activeKey: documentId,
                maxAttempts,
              },
            });
            await transaction.document.update({
              where: { id: documentId },
              data: {
                status: "QUEUED",
                processingErrorCode: null,
                processingErrorMessage: null,
              },
            });
            return job;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          transactionAttempt < 3
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Unreachable transaction retry state.");
  },

  async markDispatchFailed(jobId: string, message: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const job = await transaction.documentJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          activeKey: null,
          completedAt: new Date(),
          errorCode: "QUEUE_UNAVAILABLE",
          errorMessage: message,
        },
      });
      await transaction.document.update({
        where: { id: job.documentId },
        data: {
          status: "FAILED",
          processingErrorCode: "QUEUE_UNAVAILABLE",
          processingErrorMessage: message,
        },
      });
    });
  },

  listOwned(documentId: string, ownerId: string): Promise<DocumentJob[]> {
    return prisma.documentJob.findMany({
      where: { documentId, document: { ownerId, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  },
};

export type DocumentJobRepository = typeof documentJobRepository;

export function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
