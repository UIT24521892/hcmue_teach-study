import { Prisma, type Question, type QuizStatus } from "@prisma/client";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";
import type { QuizItemRecord, QuizSnapshot, QuizWithCount, QuizWithItems } from "./quiz.mapper.js";

const STALE_MESSAGE = "Quiz đã thay đổi ở một phiên khác. Hãy tải lại dữ liệu.";

/** Only items that still render: a live source question or a frozen snapshot. */
const visibleItemsWhere: Prisma.QuizQuestionWhereInput = {
  OR: [{ questionId: { not: null } }, { snapshot: { not: Prisma.DbNull } }],
};

const itemsInclude = {
  items: {
    include: {
      question: { include: { document: { select: { ownerId: true, deletedAt: true } } } },
    },
    orderBy: { position: "asc" },
  },
} satisfies Prisma.QuizInclude;

function ownedQuizWhere(ownerId: string, quizId: string): Prisma.QuizWhereInput {
  return { id: quizId, ownerId, deletedAt: null };
}

type Transaction = Prisma.TransactionClient;

async function findOwnedIn(
  client: Transaction | typeof prisma,
  ownerId: string,
  quizId: string,
): Promise<QuizWithItems> {
  const quiz = await client.quiz.findFirst({
    where: ownedQuizWhere(ownerId, quizId),
    include: itemsInclude,
  });
  if (!quiz) throw HttpError.notFound("Không tìm thấy quiz.");
  return quiz;
}

/**
 * Compare-and-set on `version` (and optionally the expected status) so two
 * tabs cannot both apply a change computed from the same stale read.
 */
async function bumpVersion(
  transaction: Transaction,
  quiz: QuizWithItems,
  expected: { version: number; statuses: QuizStatus[] },
  data: Prisma.QuizUpdateManyMutationInput,
): Promise<void> {
  if (quiz.version !== expected.version) {
    throw HttpError.conflict(STALE_MESSAGE, { currentVersion: quiz.version });
  }
  const changed = await transaction.quiz.updateMany({
    where: { id: quiz.id, version: expected.version, status: { in: expected.statuses } },
    data: { ...data, version: { increment: 1 } },
  });
  if (changed.count === 0) throw HttpError.conflict(STALE_MESSAGE);
}

export interface QuizDraftInput {
  title?: string;
  description?: string | null;
  timeLimitSeconds?: number | null;
}

export const quizRepository = {
  /** Owned, non-deleted questions among `ids`; callers decide what is missing. */
  findOwnedQuestions(ownerId: string, ids: string[]): Promise<Question[]> {
    return prisma.question.findMany({
      where: { id: { in: ids }, document: { ownerId, deletedAt: null } },
    });
  },

  async create(input: {
    id: string;
    ownerId: string;
    title: string;
    description: string | null;
    timeLimitSeconds: number | null;
    questionIds: string[];
  }): Promise<QuizWithItems> {
    return prisma.quiz.create({
      data: {
        id: input.id,
        ownerId: input.ownerId,
        title: input.title,
        description: input.description,
        timeLimitSeconds: input.timeLimitSeconds,
        items: {
          create: input.questionIds.map((questionId, index) => ({
            questionId,
            position: index + 1,
          })),
        },
      },
      include: itemsInclude,
    });
  },

  findOwned(ownerId: string, quizId: string): Promise<QuizWithItems> {
    return findOwnedIn(prisma, ownerId, quizId);
  },

  async listOwned(
    ownerId: string,
    input: { skip: number; take: number; status?: QuizStatus },
  ): Promise<{ items: QuizWithCount[]; total: number }> {
    const where: Prisma.QuizWhereInput = {
      ownerId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.quiz.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: input.skip,
        take: input.take,
        include: { _count: { select: { items: { where: visibleItemsWhere } } } },
      }),
      prisma.quiz.count({ where }),
    ]);
    return { items, total };
  },

  async updateDraft(input: {
    ownerId: string;
    quizId: string;
    version: number;
    data: QuizDraftInput;
    questionIds?: string[];
  }): Promise<QuizWithItems> {
    return prisma.$transaction(async (transaction) => {
      const quiz = await findOwnedIn(transaction, input.ownerId, input.quizId);
      if (quiz.status !== "DRAFT") {
        throw HttpError.conflict("Chỉ sửa được quiz ở trạng thái nháp.");
      }
      await bumpVersion(
        transaction,
        quiz,
        { version: input.version, statuses: ["DRAFT"] },
        {
          ...input.data,
        },
      );
      if (input.questionIds) {
        await transaction.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
        await transaction.quizQuestion.createMany({
          data: input.questionIds.map((questionId, index) => ({
            quizId: quiz.id,
            questionId,
            position: index + 1,
          })),
        });
      }
      return findOwnedIn(transaction, input.ownerId, input.quizId);
    });
  },

  /**
   * Freezes every item in one transaction. `freeze` validates the live items
   * and returns the snapshot per item id; orphaned draft items are dropped.
   */
  async publish(input: {
    ownerId: string;
    quizId: string;
    version: number;
    now: Date;
    freeze: (items: QuizItemRecord[]) => Map<string, QuizSnapshot>;
  }): Promise<QuizWithItems> {
    return prisma.$transaction(async (transaction) => {
      const quiz = await findOwnedIn(transaction, input.ownerId, input.quizId);
      if (quiz.status !== "DRAFT") {
        throw HttpError.conflict("Quiz này đã được công bố hoặc lưu trữ.");
      }
      if (quiz.version !== input.version) {
        throw HttpError.conflict(STALE_MESSAGE, { currentVersion: quiz.version });
      }
      const snapshots = input.freeze(quiz.items);
      await bumpVersion(
        transaction,
        quiz,
        { version: input.version, statuses: ["DRAFT"] },
        {
          status: "PUBLISHED",
          publishedAt: input.now,
        },
      );
      await transaction.quizQuestion.deleteMany({
        where: { quizId: quiz.id, id: { notIn: [...snapshots.keys()] } },
      });
      for (const [itemId, snapshot] of snapshots) {
        await transaction.quizQuestion.update({
          where: { id: itemId },
          data: { snapshot: snapshot as Prisma.InputJsonValue },
        });
      }
      return findOwnedIn(transaction, input.ownerId, input.quizId);
    });
  },

  async archive(input: {
    ownerId: string;
    quizId: string;
    version: number;
    now: Date;
  }): Promise<QuizWithItems> {
    return prisma.$transaction(async (transaction) => {
      const quiz = await findOwnedIn(transaction, input.ownerId, input.quizId);
      if (quiz.status === "ARCHIVED") {
        throw HttpError.conflict("Quiz này đã được lưu trữ.");
      }
      await bumpVersion(
        transaction,
        quiz,
        { version: input.version, statuses: ["DRAFT", "PUBLISHED"] },
        { status: "ARCHIVED", archivedAt: input.now },
      );
      return findOwnedIn(transaction, input.ownerId, input.quizId);
    });
  },
};

export type QuizRepository = typeof quizRepository;
