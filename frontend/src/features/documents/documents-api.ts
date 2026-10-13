import {
  listDocumentJobsResponseSchema,
  listDocumentsResponseSchema,
  listQuestionsResponseSchema,
  processDocumentResponseSchema,
  questionResponseSchema,
  uploadDocumentResponseSchema,
  type ReviewQuestionRequest,
  type UpdateQuestionRequest,
} from "@mach/contracts";

import type { ApiClient } from "../auth/api-client";

export function createDocumentsApi(client: ApiClient) {
  return {
    list(page = 1, pageSize = 50) {
      return client.request(`/documents?page=${page}&pageSize=${pageSize}`, {
        schema: listDocumentsResponseSchema,
      });
    },
    upload(file: File) {
      const form = new FormData();
      form.set("file", file);
      return client.request("/documents", {
        method: "POST",
        body: form,
        schema: uploadDocumentResponseSchema,
      });
    },
    process(documentId: string) {
      return client.request(`/documents/${encodeURIComponent(documentId)}/process`, {
        method: "POST",
        schema: processDocumentResponseSchema,
      });
    },
    jobs(documentId: string) {
      return client.request(`/documents/${encodeURIComponent(documentId)}/jobs`, {
        schema: listDocumentJobsResponseSchema,
      });
    },
    questions(documentId: string, status?: "approved") {
      const filter = status ? `&status=${status}` : "";
      return client.request(
        `/documents/${encodeURIComponent(documentId)}/questions?page=1&pageSize=50${filter}`,
        {
          schema: listQuestionsResponseSchema,
        },
      );
    },
    updateQuestion(documentId: string, questionId: string, input: UpdateQuestionRequest) {
      return client.request(
        `/documents/${encodeURIComponent(documentId)}/questions/${encodeURIComponent(questionId)}`,
        { method: "PATCH", body: input, schema: questionResponseSchema },
      );
    },
    reviewQuestion(documentId: string, questionId: string, input: ReviewQuestionRequest) {
      return client.request(
        `/documents/${encodeURIComponent(documentId)}/questions/${encodeURIComponent(questionId)}/review`,
        { method: "POST", body: input, schema: questionResponseSchema },
      );
    },
  };
}
