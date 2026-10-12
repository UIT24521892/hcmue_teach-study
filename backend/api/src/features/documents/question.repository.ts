import type { Prisma, Question, QuestionReviewStatus } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";

interface OwnedQuestionInput {
  ownerId: string;
  documentId: string;
  questionId: string;
}

function ownedWhere(input: OwnedQuestionInput): Prisma.QuestionWhereInput {
  return {
    id: input.questionId,
    documentId: input.documentId,
    document: { ownerId: input.ownerId, deletedAt: null },
  };
}

export const questionRepository = {
  async listOwned(
    ownerId: string,
    documentId: string,
    input: { skip: number; take: number; reviewStatus?: QuestionReviewStatus },
  ): Promise<{ items: Question[]; total: number }> {
    const where: Prisma.QuestionWhereInput = {
      documentId,
      document: { ownerId, deletedAt: null },
      ...(input.reviewStatus ? { reviewStatus: input.reviewStatus } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.question.findMany({
        where,
        orderBy: { createdAt: "asc" },
        skip: input.skip,
        take: input.take,
      }),
      prisma.question.count({ where }),
    ]);
    return { items, total };
  },

  findOwned(input: OwnedQuestionInput): Promise<Question | null> {
    return prisma.question.findFirst({ where: ownedWhere(input) });
  },

  async updateOwned(
    input: OwnedQuestionInput & {
      editorId: string;
      version: number;
      data: Prisma.QuestionUpdateManyMutationInput;
      reason: string;
    },
  ): Promise<Question> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.question.findFirst({ where: ownedWhere(input) });
      if (!current) throw HttpError.notFound("Không tìm thấy câu hỏi.");
      if (current.version !== input.version) {
        throw HttpError.conflict("Câu hỏi đã thay đổi ở một phiên khác. Hãy tải lại dữ liệu.", {
          currentVersion: current.version,
        });
      }

      await transaction.questionRevision.create({
        data: {
          questionId: current.id,
          editorId: input.editorId,
          reason: input.reason,
          previousValues: {
            prompt: current.prompt,
            options: current.options,
            correctAnswer: current.correctAnswer,
            explanation: current.explanation,
            difficulty: current.difficulty,
            reviewStatus: current.reviewStatus,
            version: current.version,
          } as Prisma.InputJsonValue,
        },
      });

      const changed = await transaction.question.updateMany({
        where: { id: current.id, version: input.version },
        data: { ...input.data, version: { increment: 1 } },
      });
      if (changed.count === 0) {
        throw HttpError.conflict("Câu hỏi đã thay đổi ở một phiên khác. Hãy tải lại dữ liệu.");
      }
      return transaction.question.findUniqueOrThrow({ where: { id: current.id } });
    });
  },
};

export type QuestionRepository = typeof questionRepository;
