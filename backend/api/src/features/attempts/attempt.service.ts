import { randomUUID } from "node:crypto";

import type { AttemptAnswerInput } from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import { toQuizDetail } from "../quizzes/quiz.mapper.js";
import { quizRepository, type QuizRepository } from "../quizzes/quiz.repository.js";
import { attemptItemRecordsSchema, gradeAttempt } from "./attempt.grading.js";
import { toAttempt, toAttemptSummary } from "./attempt.mapper.js";
import {
  attemptRepository,
  type AttemptRecord,
  type AttemptRepository,
} from "./attempt.repository.js";

/** Network latency allowance after the deadline for saves and final answers. */
export const SUBMIT_GRACE_MS = 5_000;

export interface AttemptServiceDependencies {
  attempts?: AttemptRepository;
  quizzes?: QuizRepository;
  clock?: () => Date;
}

export function createAttemptService(dependencies: AttemptServiceDependencies = {}) {
  const attempts = dependencies.attempts ?? attemptRepository;
  const quizzes = dependencies.quizzes ?? quizRepository;
  const clock = dependencies.clock ?? (() => new Date());

  function isPastGrace(attempt: AttemptRecord, now: Date): boolean {
    return (
      attempt.deadlineAt !== null && now.getTime() > attempt.deadlineAt.getTime() + SUBMIT_GRACE_MS
    );
  }

  function assertPositions(attempt: AttemptRecord, answers: AttemptAnswerInput[]): void {
    const invalid = answers.filter((answer) => answer.position > attempt.totalCount);
    if (invalid.length > 0) {
      throw HttpError.badRequest("Câu trả lời không thuộc bài làm này.", {
        positions: invalid.map((answer) => answer.position),
      });
    }
  }

  async function reload(userId: string, attemptId: string): Promise<AttemptRecord> {
    const attempt = await attempts.findOwned(userId, attemptId);
    if (!attempt) throw HttpError.notFound("Không tìm thấy bài làm.");
    return attempt;
  }

  /** Grades with whatever is saved plus `finalAnswers`; safe to call twice. */
  async function finalize(attempt: AttemptRecord, now: Date, finalAnswers: AttemptAnswerInput[]) {
    await attempts.finalize({
      userId: attempt.userId,
      attemptId: attempt.id,
      now,
      finalAnswers,
      grade: (items, responses) => gradeAttempt(attemptItemRecordsSchema.parse(items), responses),
    });
    return reload(attempt.userId, attempt.id);
  }

  /**
   * Who may take a quiz. Until assignments exist (Phase 5) only the owner can
   * run their own published quiz, which is how self-learners practise and how
   * teachers try a quiz before assigning it.
   */
  async function findAttemptableQuiz(userId: string, quizId: string) {
    const quiz = await quizzes.findOwned(userId, quizId);
    if (quiz.status !== "PUBLISHED") {
      throw HttpError.conflict("Chỉ làm được quiz đã công bố và chưa lưu trữ.");
    }
    return quiz;
  }

  return {
    async start(userId: string, quizId: string) {
      const quiz = await findAttemptableQuiz(userId, quizId);
      const now = clock();
      const activeKey = `${quizId}:${userId}`;

      const active = await attempts.findActive(activeKey);
      if (active && !isPastGrace(active, now)) {
        return { attempt: toAttempt(active, now), created: false };
      }
      if (active) await finalize(active, now, []);

      const items = toQuizDetail(quiz).items.map(({ sourceQuestionId: _source, ...item }) => item);
      const created = await attempts.create({
        id: randomUUID(),
        quizId,
        userId,
        activeKey,
        items,
        startedAt: now,
        deadlineAt:
          quiz.timeLimitSeconds === null
            ? null
            : new Date(now.getTime() + quiz.timeLimitSeconds * 1_000),
      });
      if (created) return { attempt: toAttempt(created, now), created: true };

      const raced = await attempts.findActive(activeKey);
      if (!raced) throw HttpError.conflict("Không mở được bài làm. Hãy thử lại.");
      return { attempt: toAttempt(raced, now), created: false };
    },

    async get(userId: string, attemptId: string) {
      const now = clock();
      let attempt = await reload(userId, attemptId);
      if (attempt.status === "IN_PROGRESS" && isPastGrace(attempt, now)) {
        attempt = await finalize(attempt, now, []);
      }
      return toAttempt(attempt, now);
    },

    async saveAnswers(userId: string, attemptId: string, answers: AttemptAnswerInput[]) {
      const now = clock();
      const attempt = await reload(userId, attemptId);
      assertPositions(attempt, answers);
      if (attempt.status === "SUBMITTED") {
        throw HttpError.conflict("Bài làm đã được nộp.");
      }
      if (isPastGrace(attempt, now)) {
        await finalize(attempt, now, []);
        throw HttpError.conflict("Đã hết giờ. Bài làm được nộp tự động với các câu đã lưu.");
      }
      const saved = await attempts.saveAnswers({ userId, attemptId, now, answers });
      if (!saved) throw HttpError.conflict("Bài làm đã được nộp.");
      return toAttempt(await reload(userId, attemptId), now);
    },

    /** Idempotent: submitting an already submitted attempt returns its result. */
    async submit(userId: string, attemptId: string, answers: AttemptAnswerInput[] = []) {
      const now = clock();
      const attempt = await reload(userId, attemptId);
      assertPositions(attempt, answers);
      if (attempt.status === "SUBMITTED") return toAttempt(attempt, now);
      // Answers sent after the deadline (plus grace) are ignored; saved ones count.
      const accepted = isPastGrace(attempt, now) ? [] : answers;
      return toAttempt(await finalize(attempt, now, accepted), now);
    },

    async listForQuiz(userId: string, quizId: string, input: { page: number; pageSize: number }) {
      const result = await attempts.listOwned(userId, quizId, {
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      });
      return {
        attempts: result.items.map(toAttemptSummary),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: result.total,
          pageCount: result.total === 0 ? 0 : Math.ceil(result.total / input.pageSize),
        },
      };
    },
  };
}
