import type {
  Question as PrismaQuestion,
  Quiz as PrismaQuiz,
  QuizQuestion as PrismaQuizQuestion,
  QuizStatus as PrismaQuizStatus,
} from "@prisma/client";

import {
  quizDetailSchema,
  quizItemSchema,
  quizSummarySchema,
  type QuizDetail,
  type QuizItem,
  type QuizStatus,
  type QuizSummary,
} from "@mach/contracts";

import { toQuestion } from "../documents/document.mapper.js";

const STATUS_MAP: Record<PrismaQuizStatus, QuizStatus> = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
};

/** Shape frozen into `quiz_questions.snapshot` when a quiz is published. */
export const quizSnapshotSchema = quizItemSchema.omit({ position: true, sourceQuestionId: true });
export type QuizSnapshot = ReturnType<typeof quizSnapshotSchema.parse>;

export type QuizSourceQuestion = PrismaQuestion & {
  document: { ownerId: string; deletedAt: Date | null };
};
export type QuizItemRecord = PrismaQuizQuestion & { question: QuizSourceQuestion | null };
export type QuizWithCount = PrismaQuiz & { _count: { items: number } };
export type QuizWithItems = PrismaQuiz & { items: QuizItemRecord[] };

export function toQuizSnapshot(question: PrismaQuestion): QuizSnapshot {
  const current = toQuestion(question);
  return quizSnapshotSchema.parse({
    sourceVersion: current.version,
    type: current.type,
    prompt: current.prompt,
    options: current.options,
    correctAnswer: current.correctAnswer,
    explanation: current.explanation,
    difficulty: current.difficulty,
  });
}

/**
 * Items are returned in position order and renumbered from 1. Draft items whose
 * source question (or its document) was deleted have no usable content and
 * are skipped instead of failing the whole quiz.
 */
function toQuizItems(items: QuizItemRecord[]): QuizItem[] {
  const content = [...items]
    .sort((left, right) => left.position - right.position)
    .flatMap((item) => {
      if (item.snapshot !== null) {
        return [{ sourceQuestionId: item.questionId, ...quizSnapshotSchema.parse(item.snapshot) }];
      }
      if (item.question && item.question.document.deletedAt === null) {
        return [{ sourceQuestionId: item.questionId, ...toQuizSnapshot(item.question) }];
      }
      return [];
    });
  return content.map((item, index) => quizItemSchema.parse({ position: index + 1, ...item }));
}

function summaryFields(quiz: PrismaQuiz, questionCount: number): QuizSummary {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    timeLimitMinutes:
      quiz.timeLimitSeconds === null ? null : Math.round(quiz.timeLimitSeconds / 60),
    status: STATUS_MAP[quiz.status],
    version: quiz.version,
    questionCount,
    publishedAt: quiz.publishedAt?.toISOString() ?? null,
    archivedAt: quiz.archivedAt?.toISOString() ?? null,
    createdAt: quiz.createdAt.toISOString(),
    updatedAt: quiz.updatedAt.toISOString(),
  };
}

export function toQuizSummary(quiz: QuizWithCount): QuizSummary {
  return quizSummarySchema.parse(summaryFields(quiz, quiz._count.items));
}

export function toQuizDetail(quiz: QuizWithItems): QuizDetail {
  const items = toQuizItems(quiz.items);
  return quizDetailSchema.parse({ ...summaryFields(quiz, items.length), items });
}
