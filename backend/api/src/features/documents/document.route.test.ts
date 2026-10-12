import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  authMeResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  listDocumentJobsResponseSchema,
  listDocumentsResponseSchema,
  listQuestionsResponseSchema,
  questionResponseSchema,
  uploadDocumentResponseSchema,
} from "@mach/contracts";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { createTestApp, testAppConfig, TEST_STORAGE_PATH } from "../../test/app.js";
import { resetAuthTables } from "../../test/database.js";

const app = createTestApp();
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", "utf8");
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function register(
  role: "teacher" | "student" | "self_learner",
  email: string,
): Promise<string> {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({
      name: `User ${role}`,
      email,
      password: "matkhau-rat-dai-123",
      role,
    })
    .expect(201);

  return authSessionSchema.parse(response.body).accessToken;
}

function uploadPdf(token: string) {
  return request(app)
    .post("/api/v1/documents")
    .set("Authorization", `Bearer ${token}`)
    .attach("file", PDF, { filename: "grammar.pdf", contentType: "application/pdf" });
}

beforeEach(async () => {
  await resetAuthTables();
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

describe("POST /api/v1/documents", () => {
  it("stores a teacher upload privately with owner metadata and SHA-256", async () => {
    const token = await register("teacher", "teacher-upload@example.com");
    const response = await uploadPdf(token).expect(201);
    const body = uploadDocumentResponseSchema.parse(response.body);
    const stored = await prisma.document.findUniqueOrThrow({ where: { id: body.document.id } });

    expect(body.document).toMatchObject({
      originalName: "grammar.pdf",
      extension: "pdf",
      mimeType: "application/pdf",
      byteSize: PDF.length,
      checksum: createHash("sha256").update(PDF).digest("hex"),
      status: "queued",
    });
    expect(body.job).toMatchObject({
      documentId: body.document.id,
      status: "queued",
      progress: 0,
      attempt: 0,
      maxAttempts: 3,
    });
    expect(body.document).not.toHaveProperty("storageKey");
    expect(body.document).not.toHaveProperty("ownerId");
    const profile = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(stored.ownerId).toBe(authMeResponseSchema.parse(profile.body).user.id);
    expect(await readFile(join(TEST_STORAGE_PATH, stored.storageKey))).toEqual(PDF);
  });

  it("accepts UTF-8 TXT and a detected image for a self learner", async () => {
    const token = await register("self_learner", "learner-upload@example.com");

    await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("Vocabulary: resilient", "utf8"), {
        filename: "vocabulary.txt",
        contentType: "text/plain",
      })
      .expect(201);

    const image = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PNG, { filename: "photo.png", contentType: "image/png" })
      .expect(201);

    expect(uploadDocumentResponseSchema.parse(image.body).document.extension).toBe("png");
    expect(await prisma.document.count()).toBe(2);
  });

  it("requires authentication and refuses student-owned uploads", async () => {
    await request(app)
      .post("/api/v1/documents")
      .attach("file", PDF, { filename: "grammar.pdf", contentType: "application/pdf" })
      .expect(401);

    const studentToken = await register("student", "student-upload@example.com");
    const response = await uploadPdf(studentToken).expect(403);

    expect(errorResponseSchema.parse(response.body).code).toBe("FORBIDDEN");
    expect(await prisma.document.count()).toBe(0);
  });

  it("rejects a fake MIME payload and unsupported extension", async () => {
    const token = await register("teacher", "mime-check@example.com");
    const fakePdf = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not a real pdf"), {
        filename: "fake.pdf",
        contentType: "application/pdf",
      })
      .expect(415);

    expect(errorResponseSchema.parse(fakePdf.body).code).toBe("UNSUPPORTED_MEDIA_TYPE");

    const html = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("<script>alert(1)</script>"), {
        filename: "payload.html",
        contentType: "text/html",
      })
      .expect(415);

    expect(errorResponseSchema.parse(html.body).code).toBe("UNSUPPORTED_MEDIA_TYPE");
    expect(await prisma.document.count()).toBe(0);
  });

  it("rejects files over the configured byte limit", async () => {
    const token = await register("teacher", "large-file@example.com");
    const response = await request(app)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.alloc(1_024 * 1_024 + 1, 65), {
        filename: "large.txt",
        contentType: "text/plain",
      })
      .expect(413);

    expect(errorResponseSchema.parse(response.body).code).toBe("PAYLOAD_TOO_LARGE");
    expect(await prisma.document.count()).toBe(0);
  });
});

describe("GET /api/v1/documents/:documentId", () => {
  it("returns an owned document but hides it from another teacher", async () => {
    const ownerToken = await register("teacher", "owner@example.com");
    const strangerToken = await register("teacher", "stranger@example.com");
    const uploaded = uploadDocumentResponseSchema.parse(
      (await uploadPdf(ownerToken).expect(201)).body,
    );

    const ownResponse = await request(app)
      .get(`/api/v1/documents/${uploaded.document.id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .expect(200);
    expect(ownResponse.body.document.id).toBe(uploaded.document.id);

    const crossAccount = await request(app)
      .get(`/api/v1/documents/${uploaded.document.id}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(404);
    expect(errorResponseSchema.parse(crossAccount.body).code).toBe("NOT_FOUND");
  });
});

describe("document list, jobs and quota", () => {
  it("paginates only owned documents and exposes polling state", async () => {
    const ownerToken = await register("teacher", "list-owner@example.com");
    const strangerToken = await register("teacher", "list-stranger@example.com");
    const uploaded = uploadDocumentResponseSchema.parse(
      (await uploadPdf(ownerToken).expect(201)).body,
    );

    const list = listDocumentsResponseSchema.parse(
      (
        await request(app)
          .get("/api/v1/documents?page=1&pageSize=10")
          .set("Authorization", `Bearer ${ownerToken}`)
          .expect(200)
      ).body,
    );
    expect(list.documents.map((document) => document.id)).toEqual([uploaded.document.id]);
    expect(list.pagination.total).toBe(1);

    const jobs = listDocumentJobsResponseSchema.parse(
      (
        await request(app)
          .get(`/api/v1/documents/${uploaded.document.id}/jobs`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .expect(200)
      ).body,
    );
    expect(jobs.jobs[0]).toMatchObject({ id: uploaded.job.id, status: "queued" });

    await request(app)
      .get(`/api/v1/documents/${uploaded.document.id}/jobs`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(404);
  });

  it("returns immediately, then completes TXT extraction and question generation in the background", async () => {
    const config = testAppConfig();
    const inlineApp = createApp({
      ...config,
      documents: { ...config.documents, jobMode: "inline", jobBackoffMs: 10 },
    });
    const tokenResponse = await request(inlineApp).post("/api/v1/auth/register").send({
      name: "Inline Teacher",
      email: "inline@example.com",
      password: "matkhau-rat-dai-123",
      role: "teacher",
    });
    const token = authSessionSchema.parse(tokenResponse.body).accessToken;
    const uploaded = uploadDocumentResponseSchema.parse(
      (
        await request(inlineApp)
          .post("/api/v1/documents")
          .set("Authorization", `Bearer ${token}`)
          .attach("file", Buffer.from("Consistent reading practice builds confidence every day."), {
            filename: "habit.txt",
            contentType: "text/plain",
          })
          .expect(201)
      ).body,
    );
    expect(uploaded.job.status).toBe("queued");

    await expect
      .poll(
        async () =>
          (await prisma.document.findUniqueOrThrow({ where: { id: uploaded.document.id } })).status,
        { timeout: 3_000, interval: 20 },
      )
      .toBe("READY");
    expect(await prisma.question.count({ where: { documentId: uploaded.document.id } })).toBe(3);

    const jobs = listDocumentJobsResponseSchema.parse(
      (
        await request(inlineApp)
          .get(`/api/v1/documents/${uploaded.document.id}/jobs`)
          .set("Authorization", `Bearer ${token}`)
          .expect(200)
      ).body,
    );
    expect(jobs.jobs[0]).toMatchObject({ status: "completed", progress: 100, attempt: 1 });
  });

  it("enforces the per-owner AI quota before storing another upload", async () => {
    const config = testAppConfig();
    const quotaApp = createApp({
      ...config,
      documents: { ...config.documents, dailyAiQuota: 1 },
    });
    const tokenResponse = await request(quotaApp).post("/api/v1/auth/register").send({
      name: "Quota Teacher",
      email: "quota@example.com",
      password: "matkhau-rat-dai-123",
      role: "teacher",
    });
    const token = authSessionSchema.parse(tokenResponse.body).accessToken;
    await request(quotaApp)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PDF, { filename: "first.pdf", contentType: "application/pdf" })
      .expect(201);

    const limited = await request(quotaApp)
      .post("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", PDF, { filename: "second.pdf", contentType: "application/pdf" })
      .expect(429);
    expect(errorResponseSchema.parse(limited.body).code).toBe("QUOTA_EXCEEDED");
    expect(await prisma.document.count()).toBe(1);
  });
});

describe("question review API", () => {
  it("lets the owner edit and approve with optimistic versioning while blocking IDOR", async () => {
    const ownerToken = await register("teacher", "question-owner@example.com");
    const strangerToken = await register("teacher", "question-stranger@example.com");
    const uploaded = uploadDocumentResponseSchema.parse(
      (await uploadPdf(ownerToken).expect(201)).body,
    );
    const question = await prisma.question.create({
      data: {
        id: "0709fc76-9c2e-4322-bbeb-27f6ec8f844e",
        documentId: uploaded.document.id,
        generationJobId: uploaded.job.id,
        type: "MULTIPLE_CHOICE",
        prompt: "Từ nào có trong tài liệu?",
        options: ["grammar", "ocean", "window"],
        correctAnswer: "grammar",
        explanation: "Grammar xuất hiện trong tài liệu.",
        difficulty: "EASY",
      },
    });

    const list = listQuestionsResponseSchema.parse(
      (
        await request(app)
          .get(`/api/v1/documents/${uploaded.document.id}/questions`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .expect(200)
      ).body,
    );
    expect(list.questions).toHaveLength(1);

    const edited = questionResponseSchema.parse(
      (
        await request(app)
          .patch(`/api/v1/documents/${uploaded.document.id}/questions/${question.id}`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .send({ prompt: "Từ nào xuất hiện trong tài liệu?", version: 1 })
          .expect(200)
      ).body,
    );
    expect(edited.question).toMatchObject({ version: 2, reviewStatus: "pending_review" });

    await request(app)
      .post(`/api/v1/documents/${uploaded.document.id}/questions/${question.id}/review`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ status: "approved", version: 1 })
      .expect(409);

    const approved = questionResponseSchema.parse(
      (
        await request(app)
          .post(`/api/v1/documents/${uploaded.document.id}/questions/${question.id}/review`)
          .set("Authorization", `Bearer ${ownerToken}`)
          .send({ status: "approved", version: 2 })
          .expect(200)
      ).body,
    );
    expect(approved.question).toMatchObject({ version: 3, reviewStatus: "approved" });
    expect(await prisma.questionRevision.count({ where: { questionId: question.id } })).toBe(2);

    await request(app)
      .get(`/api/v1/documents/${uploaded.document.id}/questions`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .expect(404);
    await request(app)
      .patch(`/api/v1/documents/${uploaded.document.id}/questions/${question.id}`)
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ prompt: "IDOR", version: 3 })
      .expect(404);
  });
});
