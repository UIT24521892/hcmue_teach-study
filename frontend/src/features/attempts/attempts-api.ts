import {
  attemptResponseSchema,
  listAttemptsResponseSchema,
  type AttemptAnswerInput,
} from "@mach/contracts";

import type { ApiClient } from "../auth/api-client";

export function createAttemptsApi(client: ApiClient) {
  return {
    start(quizId: string) {
      return client.request(`/quizzes/${encodeURIComponent(quizId)}/attempts`, {
        method: "POST",
        schema: attemptResponseSchema,
      });
    },
    history(quizId: string, page = 1, pageSize = 10) {
      return client.request(
        `/quizzes/${encodeURIComponent(quizId)}/attempts?page=${page}&pageSize=${pageSize}`,
        { schema: listAttemptsResponseSchema },
      );
    },
    get(attemptId: string) {
      return client.request(`/attempts/${encodeURIComponent(attemptId)}`, {
        schema: attemptResponseSchema,
      });
    },
    save(attemptId: string, answers: AttemptAnswerInput[]) {
      return client.request(`/attempts/${encodeURIComponent(attemptId)}/answers`, {
        method: "PUT",
        body: { answers },
        schema: attemptResponseSchema,
      });
    },
    submit(attemptId: string, answers: AttemptAnswerInput[]) {
      return client.request(`/attempts/${encodeURIComponent(attemptId)}/submit`, {
        method: "POST",
        body: { answers },
        schema: attemptResponseSchema,
      });
    },
  };
}
