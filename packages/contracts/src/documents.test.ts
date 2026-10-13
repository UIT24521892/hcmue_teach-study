import { describe, expect, it } from "vitest";

import {
  documentJobSchema,
  documentSchema,
  questionSchema,
  reviewQuestionRequestSchema,
  updateQuestionRequestSchema,
  uploadDocumentResponseSchema,
} from "./documents.js";

const document = {
  id: "doc_1",
  originalName: "lesson.pdf",
  extension: "pdf",
  mimeType: "application/pdf",
  byteSize: 42,
  checksum: "a".repeat(64),
  status: "uploaded",
  characterCount: null,
  pageCount: null,
  processingError: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("document contracts", () => {
  it("accepts public upload metadata without a storage path", () => {
    const parsed = uploadDocumentResponseSchema.parse({
      document: { ...document, storageKey: "private/user/doc.pdf" },
      job: {
        id: "8d5bb329-36b9-4d43-9688-e607f7ed576f",
        documentId: "18ea5220-111c-4143-a108-5ed19cbf5f76",
        status: "queued",
        progress: 0,
        attempt: 0,
        maxAttempts: 3,
        error: null,
        createdAt: "2026-09-20T02:00:00.000Z",
        startedAt: null,
        completedAt: null,
        updatedAt: "2026-09-20T02:00:00.000Z",
      },
    });

    expect(parsed.document).toEqual(document);
    expect(parsed.document).not.toHaveProperty("storageKey");
  });

  it("rejects unknown extensions, MIME types and malformed checksums", () => {
    expect(documentSchema.safeParse({ ...document, extension: "html" }).success).toBe(false);
    expect(documentSchema.safeParse({ ...document, mimeType: "text/html" }).success).toBe(false);
    expect(documentSchema.safeParse({ ...document, checksum: "not-a-digest" }).success).toBe(false);
  });

  it("validates polling jobs and editable review questions", () => {
    expect(
      documentJobSchema.parse({
        id: "8d5bb329-36b9-4d43-9688-e607f7ed576f",
        documentId: "18ea5220-111c-4143-a108-5ed19cbf5f76",
        status: "processing",
        progress: 55,
        attempt: 1,
        maxAttempts: 3,
        error: null,
        createdAt: "2026-09-20T02:00:00.000Z",
        startedAt: "2026-09-20T02:00:01.000Z",
        completedAt: null,
        updatedAt: "2026-09-20T02:00:02.000Z",
      }).progress,
    ).toBe(55);

    const question = questionSchema.parse({
      id: "0709fc76-9c2e-4322-bbeb-27f6ec8f844e",
      documentId: "18ea5220-111c-4143-a108-5ed19cbf5f76",
      type: "multiple_choice",
      prompt: "Từ nào xuất hiện trong tài liệu?",
      options: ["habit", "window", "ocean"],
      correctAnswer: "habit",
      explanation: "Từ habit xuất hiện trong đoạn nguồn.",
      difficulty: "easy",
      reviewStatus: "pending_review",
      version: 1,
      createdAt: "2026-09-20T02:00:00.000Z",
      updatedAt: "2026-09-20T02:00:00.000Z",
    });
    expect(question.reviewStatus).toBe("pending_review");
    expect(updateQuestionRequestSchema.parse({ prompt: "Câu đã sửa", version: 1 }).version).toBe(1);
    expect(reviewQuestionRequestSchema.parse({ status: "approved", version: 2 }).status).toBe(
      "approved",
    );
  });
});
