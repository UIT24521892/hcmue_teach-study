import { Prisma, type AttemptAnswer, type QuizAttempt } from "@prisma/client";

import type { AttemptAnswerInput } from "@mach/contracts";

import { prisma } from "../../lib/prisma.js";
import type { AttemptItemRecord, GradedAttempt } from "./attempt.grading.js";

export type AttemptRecord = QuizAttempt & {
  answers: AttemptAnswer[];
  quiz: { title: string };
};

const attemptInclude = {
  answers: { orderBy: { position: "asc" } },
  quiz: { select: { title: true } },
} satisfies Prisma.QuizAttemptInclude;

type Transaction = Prisma.TransactionClient;

/** Empty responses delete the saved row so "cleared" and "never answered" match. */
async function writeAnswers(
  transaction: Transaction,
  attemptId: string,
  answers: AttemptAnswerInput[],
): Promise<void> {
  for (const answer of answers) {
    if (answer.response === "") {
      await transaction.attemptAnswer.deleteMany({
        where: { attemptId, position: answer.position },
      });
      continue;
    }
    await transaction.attemptAnswer.upsert({
      where: { attemptId_position: { attemptId, position: answer.position } },
      create: { attemptId, position: answer.position, response: answer.response },
      update: { response: answer.response },
    });
  }
}

export const attemptRepository = {
  findOwned(userId: string, attemptId: string): Promise<AttemptRecord | null> {
    return prisma.quizAttempt.findFirst({
      where: { id: attemptId, userId },
      include: attemptInclude,
    });
  },

  findActive(activeKey: string): Promise<AttemptRecord | null> {
    return prisma.quizAttempt.findUnique({ where: { activeKey }, include: attemptInclude });
  },

  async create(input: {
    id: string;
    quizId: string;
    userId: string;
    activeKey: string;
    items: AttemptItemRecord[];
    startedAt: Date;
    deadlineAt: Date | null;
  }): Promise<AttemptRecord | null> {
    try {
      return await prisma.quizAttempt.create({
        data: {
          id: input.id,
          quizId: input.quizId,
          userId: input.userId,
          activeKey: input.activeKey,
          items: input.items as Prisma.InputJsonValue,
          totalCount: input.items.length,
          startedAt: input.startedAt,
          deadlineAt: input.deadlineAt,
        },
        include: attemptInclude,
      });
    } catch (error) {
      // A concurrent start already opened the attempt; the caller resumes it.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  },

  async listOwned(
    userId: string,
    quizId: string,
    input: { skip: number; take: number },
  ): Promise<{ items: AttemptRecord[]; total: number }> {
    const where: Prisma.QuizAttemptWhereInput = { userId, quizId };
    const [items, total] = await prisma.$transaction([
      prisma.quizAttempt.findMany({
        where,
        orderBy: { startedAt: "desc" },
        skip: input.skip,
        take: input.take,
        include: attemptInclude,
      }),
      prisma.quizAttempt.count({ where }),
    ]);
    return { items, total };
  },

  /**
   * The conditional update takes the attempt's row lock first, so a save and
   * a submit for the same attempt are serialized: a save never lands after
   * grading. Returns false when the attempt is no longer in progress.
   */
  async saveAnswers(input: {
    userId: string;
    attemptId: string;
    now: Date;
    answers: AttemptAnswerInput[];
  }): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const locked = await transaction.quizAttempt.updateMany({
        where: { id: input.attemptId, userId: input.userId, status: "IN_PROGRESS" },
        data: { updatedAt: input.now },
      });
      if (locked.count === 0) return false;
      await writeAnswers(transaction, input.attemptId, input.answers);
      return true;
    });
  },

  /**
   * Submits and grades exactly once. A second caller finds the status already
   * changed and gets `false`, then simply re-reads the stored result.
   */
  async finalize(input: {
    userId: string;
    attemptId: string;
    now: Date;
    finalAnswers: AttemptAnswerInput[];
    grade: (items: unknown, responses: Map<number, string>) => GradedAttempt;
  }): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const locked = await transaction.quizAttempt.updateMany({
        where: { id: input.attemptId, userId: input.userId, status: "IN_PROGRESS" },
        data: { status: "SUBMITTED", activeKey: null, submittedAt: input.now },
      });
      if (locked.count === 0) return false;

      await writeAnswers(transaction, input.attemptId, input.finalAnswers);
      const attempt = await transaction.quizAttempt.findUniqueOrThrow({
        where: { id: input.attemptId },
        include: { answers: true },
      });
      const responses = new Map(
        attempt.answers.map((answer) => [answer.position, answer.response]),
      );
      const graded = input.grade(attempt.items, responses);
      for (const answer of attempt.answers) {
        await transaction.attemptAnswer.update({
          where: { id: answer.id },
          data: { isCorrect: graded.correctness.get(answer.position) ?? false },
        });
      }
      await transaction.quizAttempt.update({
        where: { id: input.attemptId },
        data: { correctCount: graded.correctCount, score: graded.score },
      });
      return true;
    });
  },
};

export type AttemptRepository = typeof attemptRepository;
