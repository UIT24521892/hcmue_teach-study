import { generatedQuestionSchema } from "@mach/document-pipeline";
import { Prisma } from "@prisma/client";
import type {
  QuestionDifficulty,
  QuestionReviewStatus,
  ReviewQuestionRequest,
  UpdateQuestionRequest,
} from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import { toQuestion } from "./document.mapper.js";
import { questionRepository, type QuestionRepository } from "./question.repository.js";

const DIFFICULTY_MAP: Record<QuestionDifficulty, "EASY" | "MEDIUM" | "HARD"> = {
  easy: "EASY",
  medium: "MEDIUM",
  hard: "HARD",
};

const REVIEW_STATUS_MAP: Record<
  Exclude<QuestionReviewStatus, "pending_review">,
  "APPROVED" | "REJECTED"
> = {
  approved: "APPROVED",
  rejected: "REJECTED",
};

export function createQuestionService(repository: QuestionRepository = questionRepository) {
  return {
    async listOwned(
      ownerId: string,
      documentId: string,
      input: { page: number; pageSize: number; status?: QuestionReviewStatus },
    ) {
      const status = input.status
        ? input.status === "pending_review"
          ? "PENDING_REVIEW"
          : REVIEW_STATUS_MAP[input.status]
        : undefined;
      const result = await repository.listOwned(ownerId, documentId, {
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        ...(status ? { reviewStatus: status } : {}),
      });
      return {
        questions: result.items.map(toQuestion),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total: result.total,
          pageCount: result.total === 0 ? 0 : Math.ceil(result.total / input.pageSize),
        },
      };
    },

    async updateOwned(
      ownerId: string,
      documentId: string,
      questionId: string,
      input: UpdateQuestionRequest,
    ) {
      const current = await repository.findOwned({ ownerId, documentId, questionId });
      if (!current) throw HttpError.notFound("Không tìm thấy câu hỏi.");
      const publicCurrent = toQuestion(current);
      const candidate = generatedQuestionSchema.safeParse({
        type: publicCurrent.type,
        prompt: input.prompt ?? publicCurrent.prompt,
        options: input.options === undefined ? publicCurrent.options : input.options,
        correctAnswer: input.correctAnswer ?? publicCurrent.correctAnswer,
        explanation: input.explanation ?? publicCurrent.explanation,
        difficulty: input.difficulty ?? publicCurrent.difficulty,
      });
      if (!candidate.success) {
        throw HttpError.badRequest("Nội dung câu hỏi sau khi sửa không hợp lệ.", {
          issues: candidate.error.issues,
        });
      }

      const updated = await repository.updateOwned({
        ownerId,
        documentId,
        questionId,
        editorId: ownerId,
        version: input.version,
        reason: "content_edit",
        data: {
          prompt: candidate.data.prompt,
          options:
            candidate.data.options === null
              ? Prisma.JsonNull
              : (candidate.data.options as Prisma.InputJsonValue),
          correctAnswer: candidate.data.correctAnswer,
          explanation: candidate.data.explanation,
          difficulty: DIFFICULTY_MAP[candidate.data.difficulty],
          reviewStatus: "PENDING_REVIEW",
        },
      });
      return toQuestion(updated);
    },

    async reviewOwned(
      ownerId: string,
      documentId: string,
      questionId: string,
      input: ReviewQuestionRequest,
    ) {
      const updated = await repository.updateOwned({
        ownerId,
        documentId,
        questionId,
        editorId: ownerId,
        version: input.version,
        reason: `review_${input.status}`,
        data: { reviewStatus: REVIEW_STATUS_MAP[input.status] },
      });
      return toQuestion(updated);
    },
  };
}
