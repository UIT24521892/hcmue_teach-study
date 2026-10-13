import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  authSessionSchema,
  errorResponseSchema,
  listQuizzesResponseSchema,
  quizResponseSchema,
  uploadDocumentResponseSchema,
} from "@mach/contracts";

import { prisma } from "../../lib/prisma.js";
import { createTestApp, TEST_STORAGE_PATH } from "../../test/app.js";
import { resetAuthTables } from "../../test/database.js";

const app = createTestApp();
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", "utf8");

async function register(role: "teacher" | "student" | "self_learner", email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: `User ${role}`, email, password: "matkhau-rat-dai-123", role })
    .expect(201);
  return authSessionSchema.parse(response.body).accessToken;
}

/** Uploads one document for the owner and seeds questions on it directly. */
async function seedQuestions(
  token: string,
  statuses: Array<"APPROVED" | "PENDING_REVIEW">,
): Promise<{ documentId: string; questionIds: string[] }> {
  const uploaded = uploadDocumentResponseSchema.parse(
    (
      await request(app)
        .post("/api/v1/documents")
        .set("Authorization", `Bearer ${token}`)
        .attach("file", PDF, { filename: "unit.pdf", contentType: "application/pdf" })
        .expect(201)
    ).body,
  );
  const questionIds: string[] = [];
  for (const [index, reviewStatus] of statuses.entries()) {
    const id = randomUUID();
    await prisma.question.create({
      data: {
        id,
        documentId: uploaded.document.id,
        generationJobId: uploaded.job.id,
        type: "MULTIPLE_CHOICE",
        prompt: `Câu hỏi số ${index + 1}?`,
        options: ["grammar", "ocean", "window"],
        correctAnswer: "grammar",
        explanation: "Grammar xuất hiện trong tài liệu.",
        difficulty: "EASY",
        reviewStatus,
      },
    });
    questionIds.push(id);
  }
  return { documentId: uploaded.document.id, questionIds };
}

function authed(method: "get" | "post" | "patch", path: string, token: string) {
  return request(app)[method](`/api/v1/quizzes${path}`).set("Authorization", `Bearer ${token}`);
}

async function createQuiz(token: string, questionIds: string[], title = "Unit 3 vocabulary") {
  const response = await authed("post", "", token)
    .send({ title, timeLimitMinutes: 10, questionIds })
    .expect(201);
  return quizResponseSchema.parse(response.body).quiz;
}

beforeEach(async () => {
  await resetAuthTables();
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

describe("quiz authoring", () => {
  it("creates a draft from approved questions in the chosen order", async () => {
    const token = await register("teacher", "quiz-owner@example.com");
    const { questionIds } = await seedQuestions(token, ["APPROVED", "APPROVED"]);
    const ordered = [questionIds[1]!, questionIds[0]!];

    const quiz = await createQuiz(token, ordered);

    expect(quiz).toMatchObject({
      status: "draft",
      version: 1,
      timeLimitMinutes: 10,
      questionCount: 2,
      publishedAt: null,
    });
    expect(quiz.items.map((item) => item.sourceQuestionId)).toEqual(ordered);
    expect(quiz.items.map((item) => item.position)).toEqual([1, 2]);

    const list = listQuizzesResponseSchema.parse(
      (await authed("get", "?status=draft", token).expect(200)).body,
    );
    expect(list.quizzes).toHaveLength(1);
    expect(list.quizzes[0]).toMatchObject({ id: quiz.id, questionCount: 2 });
    expect(list.pagination.total).toBe(1);
  });

  it("refuses pending questions and another owner's questions", async () => {
    const token = await register("teacher", "quiz-pending@example.com");
    const strangerToken = await register("teacher", "quiz-other@example.com");
    const own = await seedQuestions(token, ["APPROVED", "PENDING_REVIEW"]);
    const foreign = await seedQuestions(strangerToken, ["APPROVED"]);

    const pending = await authed("post", "", token)
      .send({ title: "Quiz", questionIds: own.questionIds })
      .expect(400);
    expect(errorResponseSchema.parse(pending.body).details).toEqual({
      notApprovedQuestionIds: [own.questionIds[1]],
    });

    await authed("post", "", token)
      .send({ title: "Quiz", questionIds: [own.questionIds[0], foreign.questionIds[0]] })
      .expect(404);
    expect(await prisma.quiz.count()).toBe(0);
  });

  it("limits authoring to owners and hides quizzes across accounts", async () => {
    const ownerToken = await register("teacher", "quiz-idor-owner@example.com");
    const strangerToken = await register("self_learner", "quiz-idor-stranger@example.com");
    const studentToken = await register("student", "quiz-student@example.com");
    const { questionIds } = await seedQuestions(ownerToken, ["APPROVED"]);
    const quiz = await createQuiz(ownerToken, questionIds);

    await request(app).get("/api/v1/quizzes").expect(401);
    const forbidden = await authed("get", "", studentToken).expect(403);
    expect(errorResponseSchema.parse(forbidden.body).code).toBe("FORBIDDEN");

    await authed("get", `/${quiz.id}`, strangerToken).expect(404);
    await authed("patch", `/${quiz.id}`, strangerToken)
      .send({ title: "IDOR", version: 1 })
      .expect(404);
    await authed("post", `/${quiz.id}/publish`, strangerToken).send({ version: 1 }).expect(404);
    await authed("post", `/${quiz.id}/archive`, strangerToken).send({ version: 1 }).expect(404);
    const strangerList = listQuizzesResponseSchema.parse(
      (await authed("get", "", strangerToken).expect(200)).body,
    );
    expect(strangerList.quizzes).toEqual([]);
  });

  it("updates drafts with optimistic versioning", async () => {
    const token = await register("teacher", "quiz-edit@example.com");
    const { questionIds } = await seedQuestions(token, ["APPROVED", "APPROVED", "APPROVED"]);
    const quiz = await createQuiz(token, questionIds.slice(0, 2));

    const updated = quizResponseSchema.parse(
      (
        await authed("patch", `/${quiz.id}`, token)
          .send({
            title: "Unit 3 — revised",
            timeLimitMinutes: null,
            questionIds: [questionIds[2], questionIds[0]],
            version: 1,
          })
          .expect(200)
      ).body,
    ).quiz;
    expect(updated).toMatchObject({
      title: "Unit 3 — revised",
      timeLimitMinutes: null,
      version: 2,
    });
    expect(updated.items.map((item) => item.sourceQuestionId)).toEqual([
      questionIds[2],
      questionIds[0],
    ]);

    const stale = await authed("patch", `/${quiz.id}`, token)
      .send({ title: "Stale", version: 1 })
      .expect(409);
    expect(errorResponseSchema.parse(stale.body).code).toBe("CONFLICT");
  });
});

describe("quiz publishing", () => {
  it("freezes question content so later bank edits do not change the quiz", async () => {
    const token = await register("teacher", "quiz-publish@example.com");
    const { documentId, questionIds } = await seedQuestions(token, ["APPROVED", "APPROVED"]);
    const quiz = await createQuiz(token, questionIds);

    const published = quizResponseSchema.parse(
      (await authed("post", `/${quiz.id}/publish`, token).send({ version: 1 }).expect(200)).body,
    ).quiz;
    expect(published).toMatchObject({ status: "published", version: 2, questionCount: 2 });
    expect(published.publishedAt).not.toBeNull();

    await request(app)
      .patch(`/api/v1/documents/${documentId}/questions/${questionIds[0]}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "Nội dung đã sửa sau khi công bố?", version: 1 })
      .expect(200);
    await prisma.question.delete({ where: { id: questionIds[1]! } });

    const reread = quizResponseSchema.parse(
      (await authed("get", `/${quiz.id}`, token).expect(200)).body,
    ).quiz;
    expect(reread.items.map((item) => item.prompt)).toEqual(["Câu hỏi số 1?", "Câu hỏi số 2?"]);
    expect(reread.items[0]).toMatchObject({ sourceQuestionId: questionIds[0], sourceVersion: 1 });
    expect(reread.items[1]?.sourceQuestionId).toBeNull();

    await authed("patch", `/${quiz.id}`, token).send({ title: "Late", version: 2 }).expect(409);
    await authed("post", `/${quiz.id}/publish`, token).send({ version: 2 }).expect(409);
  });

  it("blocks publishing while an edited question waits for review again", async () => {
    const token = await register("self_learner", "quiz-recheck@example.com");
    const { documentId, questionIds } = await seedQuestions(token, ["APPROVED", "APPROVED"]);
    const quiz = await createQuiz(token, questionIds);
    await request(app)
      .patch(`/api/v1/documents/${documentId}/questions/${questionIds[1]}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ explanation: "Giải thích mới.", version: 1 })
      .expect(200);

    const blocked = await authed("post", `/${quiz.id}/publish`, token)
      .send({ version: 1 })
      .expect(409);
    expect(errorResponseSchema.parse(blocked.body).details).toEqual({
      notApprovedQuestionIds: [questionIds[1]],
    });
    expect((await prisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).status).toBe("DRAFT");
  });

  it("drops removed sources on publish and refuses an empty quiz", async () => {
    const token = await register("teacher", "quiz-orphan@example.com");
    const { questionIds } = await seedQuestions(token, ["APPROVED", "APPROVED"]);
    const quiz = await createQuiz(token, questionIds);
    await prisma.question.delete({ where: { id: questionIds[0]! } });

    const published = quizResponseSchema.parse(
      (await authed("post", `/${quiz.id}/publish`, token).send({ version: 1 }).expect(200)).body,
    ).quiz;
    expect(published.items.map((item) => item.sourceQuestionId)).toEqual([questionIds[1]]);
    expect(await prisma.quizQuestion.count({ where: { quizId: quiz.id } })).toBe(1);

    const emptyQuiz = await createQuiz(token, [questionIds[1]!], "Empty");
    await prisma.question.delete({ where: { id: questionIds[1]! } });
    await authed("post", `/${emptyQuiz.id}/publish`, token).send({ version: 1 }).expect(409);
  });

  it("archives a published quiz once", async () => {
    const token = await register("teacher", "quiz-archive@example.com");
    const { questionIds } = await seedQuestions(token, ["APPROVED"]);
    const quiz = await createQuiz(token, questionIds);
    await authed("post", `/${quiz.id}/publish`, token).send({ version: 1 }).expect(200);

    const archived = quizResponseSchema.parse(
      (await authed("post", `/${quiz.id}/archive`, token).send({ version: 2 }).expect(200)).body,
    ).quiz;
    expect(archived).toMatchObject({ status: "archived", version: 3, questionCount: 1 });
    expect(archived.archivedAt).not.toBeNull();
    await authed("post", `/${quiz.id}/archive`, token).send({ version: 3 }).expect(409);
  });
});
