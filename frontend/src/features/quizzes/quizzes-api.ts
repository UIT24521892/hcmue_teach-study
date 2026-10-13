import {
  listQuizzesResponseSchema,
  quizResponseSchema,
  type CreateQuizRequest,
  type QuizStatus,
  type UpdateQuizRequest,
} from "@mach/contracts";

import type { ApiClient } from "../auth/api-client";

export function createQuizzesApi(client: ApiClient) {
  return {
    list(page = 1, pageSize = 50, status?: QuizStatus) {
      const filter = status ? `&status=${status}` : "";
      return client.request(`/quizzes?page=${page}&pageSize=${pageSize}${filter}`, {
        schema: listQuizzesResponseSchema,
      });
    },
    get(quizId: string) {
      return client.request(`/quizzes/${encodeURIComponent(quizId)}`, {
        schema: quizResponseSchema,
      });
    },
    create(input: CreateQuizRequest) {
      return client.request("/quizzes", {
        method: "POST",
        body: input,
        schema: quizResponseSchema,
      });
    },
    update(quizId: string, input: UpdateQuizRequest) {
      return client.request(`/quizzes/${encodeURIComponent(quizId)}`, {
        method: "PATCH",
        body: input,
        schema: quizResponseSchema,
      });
    },
    publish(quizId: string, version: number) {
      return client.request(`/quizzes/${encodeURIComponent(quizId)}/publish`, {
        method: "POST",
        body: { version },
        schema: quizResponseSchema,
      });
    },
    archive(quizId: string, version: number) {
      return client.request(`/quizzes/${encodeURIComponent(quizId)}/archive`, {
        method: "POST",
        body: { version },
        schema: quizResponseSchema,
      });
    },
  };
}
