import { randomUUID } from "node:crypto";

import type { CreateQuizRequest, QuizStatus, UpdateQuizRequest } from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import {
  toQuizDetail,
  toQuizSnapshot,
  toQuizSummary,
  type QuizItemRecord,
  type QuizSnapshot,
} from "./quiz.mapper.js";
import { quizRepository, type QuizDraftInput, type QuizRepository } from "./quiz.repository.js";

const STATUS_MAP: Record<QuizStatus, "DRAFT" | "PUBLISHED" | "ARCHIVED"> = {
  draft: "DRAFT",
  published: "PUBLISHED",
  archived: "ARCHIVED",
};

function toSeconds(minutes: number | null | undefined): number | null | undefined {
  return minutes === undefined || minutes === null ? minutes : minutes * 60;
}

/**
 * Publish-time rule: every live item must still be an approved question of the
 * owner. Items whose source was removed are dropped; an edited question that
 * fell back to `pending_review` blocks publishing until it is approved again.
 */
export function freezeDraftItems(
  ownerId: string,
  items: QuizItemRecord[],
): Map<string, QuizSnapshot> {
  const snapshots = new Map<string, QuizSnapshot>();
  const notApprovedQuestionIds: string[] = [];

  for (const item of items) {
    const question = item.question;
    if (!question || question.document.deletedAt !== null || question.document.ownerId !== ownerId)
      continue;
    if (question.reviewStatus !== "APPROVED") {
      notApprovedQuestionIds.push(question.id);
      continue;
    }
    snapshots.set(item.id, toQuizSnapshot(question));
  }

  if (notApprovedQuestionIds.length > 0) {
    throw HttpError.conflict(
      "Có câu hỏi chưa được duyệt lại sau khi sửa. Hãy duyệt trước khi công bố.",
      {
        notApprovedQuestionIds,
      },
    );
  }
  if (snapshots.size === 0) {
    throw HttpError.conflict("Quiz cần ít nhất một câu hỏi đã duyệt để công bố.");
  }
  return snapshots;
}

export function createQuizService(
  repository: QuizRepository = quizRepository,
  clock: () => Date = () => new Date(),
) {
  async function assertSelectableQuestions(ownerId: string, questionIds: string[]) {
    const found = await repository.findOwnedQuestions(ownerId, questionIds);
    const foundIds = new Set(found.map((question) => question.id));
    if (questionIds.some((id) => !foundIds.has(id))) {
      // Cross-owner ids are indistinguishable from missing ones.
      throw HttpError.notFound("Không tìm thấy câu hỏi.");
    }
    const notApprovedQuestionIds = found
      .filter((question) => question.reviewStatus !== "APPROVED")
      .map((question) => question.id);
    if (notApprovedQuestionIds.length > 0) {
      throw HttpError.badRequest("Quiz chỉ được dùng câu hỏi đã duyệt.", {
        notApprovedQuestionIds,
      });
    }
  }

  return {
    async create(ownerId: string, input: CreateQuizRequest) {
      await assertSelectableQuestions(ownerId, input.questionIds);
      const created = await repository.create({
        id: randomUUID(),
        ownerId,
        title: input.title,
        description: input.description || null,
        timeLimitSeconds: toSeconds(input.timeLimitMinutes) ?? null,
        questionIds: input.questionIds,
      });
      return toQuizDetail(created);
    },

    async listOwned(
      ownerId: string,
      input: { page: number; pageSize: number; status?: QuizStatus },
    ) {
      const result = await repository.listOwned(ownerId, {
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        ...(input.status ? { status: STATUS_MAP[input.status] } : {}),
      });
      return {
        quizzes: result.items.map(toQuizSummary),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: result.total,
          pageCount: result.total === 0 ? 0 : Math.ceil(result.total / input.pageSize),
        },
      };
    },

    async getOwned(ownerId: string, quizId: string) {
      return toQuizDetail(await repository.findOwned(ownerId, quizId));
    },

    async updateDraft(ownerId: string, quizId: string, input: UpdateQuizRequest) {
      if (input.questionIds) await assertSelectableQuestions(ownerId, input.questionIds);
      const data: QuizDraftInput = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description || null;
      if (input.timeLimitMinutes !== undefined) {
        data.timeLimitSeconds = toSeconds(input.timeLimitMinutes) ?? null;
      }
      const updated = await repository.updateDraft({
        ownerId,
        quizId,
        version: input.version,
        data,
        ...(input.questionIds ? { questionIds: input.questionIds } : {}),
      });
      return toQuizDetail(updated);
    },

    async publish(ownerId: string, quizId: string, version: number) {
      const published = await repository.publish({
        ownerId,
        quizId,
        version,
        now: clock(),
        freeze: (items) => freezeDraftItems(ownerId, items),
      });
      return toQuizDetail(published);
    },

    async archive(ownerId: string, quizId: string, version: number) {
      return toQuizDetail(await repository.archive({ ownerId, quizId, version, now: clock() }));
    },
  };
}
