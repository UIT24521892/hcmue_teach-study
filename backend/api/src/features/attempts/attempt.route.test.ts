import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import { Prisma } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  attemptResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  listAttemptsResponseSchema,
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

function authed(method: "get" | "post" | "put" | "patch", path: string, token: string) {
  return request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
}

/**
 * Publishes a three-question quiz (choice, fill-in, true/false) owned by the
 * token's user and returns its ids.
 */
async function publishedQuiz(token: string, timeLimitMinutes: number | null = null) {
  const uploaded = uploadDocumentResponseSchema.parse(
    (
      await authed("post", "/documents", token)
        .attach("file", PDF, { filename: "unit.pdf", contentType: "application/pdf" })
        .expect(201)
    ).body,
  );
  const common = {
    documentId: uploaded.document.id,
    generationJobId: uploaded.job.id,
    difficulty: "EASY" as const,
    reviewStatus: "APPROVED" as const,
  };
  const questions = [
    {
      type: "MULTIPLE_CHOICE" as const,
      prompt: "Which word is in the text?",
      options: ["grammar", "ocean", "window"],
      correctAnswer: "grammar",
      explanation: "Grammar is in the first line.",
    },
    {
      type: "FILL_BLANK" as const,
      prompt: "____ habits help learners.",
      options: Prisma.JsonNull,
      correctAnswer: "Daily",
      explanation: "The text starts with Daily.",
    },
    {
      type: "TRUE_FALSE" as const,
      prompt: "The text mentions oceans.",
      options: Prisma.JsonNull,
      correctAnswer: "false",
      explanation: "Oceans are not mentioned.",
    },
  ];
  const questionIds: string[] = [];
  for (const question of questions) {
    const id = randomUUID();
    await prisma.question.create({ data: { id, ...common, ...question } });
    questionIds.push(id);
  }
  const quiz = quizResponseSchema.parse(
    (
      await authed("post", "/quizzes", token)
        .send({ title: "Unit 3 check", timeLimitMinutes, questionIds })
        .expect(201)
    ).body,
  ).quiz;
  await authed("post", `/quizzes/${quiz.id}/publish`, token).send({ version: 1 }).expect(200);
  return { quizId: quiz.id, documentId: uploaded.document.id, questionIds };
}

async function startAttempt(token: string, quizId: string, status = 201) {
  const response = await authed("post", `/quizzes/${quizId}/attempts`, token).expect(status);
  return attemptResponseSchema.parse(response.body).attempt;
}

const correctAnswers = [
  { position: 1, response: "grammar" },
  { position: 2, response: "  daily " },
  { position: 3, response: "false" },
];

beforeEach(async () => {
  await resetAuthTables();
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

describe("starting and resuming attempts", () => {
  it("opens one attempt, resumes it and never sends answers while in progress", async () => {
    const token = await register("self_learner", "attempt-start@example.com");
    const { quizId } = await publishedQuiz(token, 15);

    const [first, second] = await Promise.all([
      authed("post", `/quizzes/${quizId}/attempts`, token),
      authed("post", `/quizzes/${quizId}/attempts`, token),
    ]);
    const ids = [first, second].map(
      (response) => attemptResponseSchema.parse(response.body).attempt.id,
    );
    expect(ids[0]).toBe(ids[1]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(await prisma.quizAttempt.count()).toBe(1);

    const attempt = attemptResponseSchema.parse(first.body).attempt;
    expect(attempt).toMatchObject({ status: "in_progress", totalCount: 3, answeredCount: 0 });
    expect(attempt.items.every((item) => item.result === null)).toBe(true);
    const raw = JSON.stringify(first.body);
    expect(raw).not.toContain("correctAnswer");
    expect(raw).not.toContain("Grammar is in the first line.");
    const deadline = new Date(attempt.deadlineAt!).getTime();
    expect(deadline - new Date(attempt.startedAt).getTime()).toBe(15 * 60_000);

    const resumed = await startAttempt(token, quizId, 200);
    expect(resumed.id).toBe(attempt.id);
  });

  it("refuses drafts, archived quizzes and quizzes the user cannot take", async () => {
    const ownerToken = await register("teacher", "attempt-owner@example.com");
    const studentToken = await register("student", "attempt-student@example.com");
    const strangerToken = await register("self_learner", "attempt-stranger@example.com");
    const { quizId } = await publishedQuiz(ownerToken);

    await authed("post", `/quizzes/${quizId}/attempts`, studentToken).expect(404);
    await authed("post", `/quizzes/${quizId}/attempts`, strangerToken).expect(404);

    await authed("post", `/quizzes/${quizId}/archive`, ownerToken).send({ version: 2 }).expect(200);
    const archived = await authed("post", `/quizzes/${quizId}/attempts`, ownerToken).expect(409);
    expect(errorResponseSchema.parse(archived.body).code).toBe("CONFLICT");
  });
});

describe("saving and submitting", () => {
  it("autosaves, clears, grades on the server and keeps the frozen content", async () => {
    const token = await register("teacher", "attempt-flow@example.com");
    const { quizId, documentId, questionIds } = await publishedQuiz(token);
    const attempt = await startAttempt(token, quizId);

    const saved = attemptResponseSchema.parse(
      (
        await authed("put", `/attempts/${attempt.id}/answers`, token)
          .send({
            answers: [
              { position: 1, response: "ocean" },
              { position: 3, response: "true" },
            ],
          })
          .expect(200)
      ).body,
    ).attempt;
    expect(saved.answeredCount).toBe(2);
    expect(saved.items.map((item) => item.response)).toEqual(["ocean", null, "true"]);

    await authed("put", `/attempts/${attempt.id}/answers`, token)
      .send({ answers: [{ position: 3, response: "" }] })
      .expect(200);
    await authed("put", `/attempts/${attempt.id}/answers`, token)
      .send({ answers: [{ position: 9, response: "x" }] })
      .expect(400);

    // Editing the bank mid-attempt must not change what is graded.
    await authed("patch", `/documents/${documentId}/questions/${questionIds[0]}`, token)
      .send({ correctAnswer: "ocean", version: 1 })
      .expect(200);

    const submitted = attemptResponseSchema.parse(
      (
        await authed("post", `/attempts/${attempt.id}/submit`, token)
          .send({ answers: [{ position: 1, response: "grammar" }, correctAnswers[1]] })
          .expect(200)
      ).body,
    ).attempt;
    expect(submitted).toMatchObject({ status: "submitted", correctCount: 2, score: 67 });
    expect(submitted.items.map((item) => item.result?.isCorrect)).toEqual([true, true, false]);
    expect(submitted.items[0]?.result).toMatchObject({
      correctAnswer: "grammar",
      explanation: "Grammar is in the first line.",
    });

    await authed("put", `/attempts/${attempt.id}/answers`, token)
      .send({ answers: [correctAnswers[2]] })
      .expect(409);
  });

  it("grades a duplicated or concurrent submit exactly once", async () => {
    const token = await register("self_learner", "attempt-double@example.com");
    const { quizId } = await publishedQuiz(token);
    const attempt = await startAttempt(token, quizId);

    const responses = await Promise.all([
      authed("post", `/attempts/${attempt.id}/submit`, token).send({ answers: correctAnswers }),
      authed("post", `/attempts/${attempt.id}/submit`, token).send({
        answers: [{ position: 1, response: "window" }],
      }),
    ]);
    const results = responses.map((response) => {
      expect(response.status).toBe(200);
      return attemptResponseSchema.parse(response.body).attempt;
    });
    expect(results[0]?.score).toBe(results[1]?.score);
    expect(results[0]?.submittedAt).toBe(results[1]?.submittedAt);

    const replay = attemptResponseSchema.parse(
      (
        await authed("post", `/attempts/${attempt.id}/submit`, token)
          .send({ answers: [{ position: 1, response: "ocean" }] })
          .expect(200)
      ).body,
    ).attempt;
    expect(replay.score).toBe(results[0]?.score);
    expect(await prisma.quizAttempt.count({ where: { status: "SUBMITTED" } })).toBe(1);

    const next = await startAttempt(token, quizId);
    expect(next.id).not.toBe(attempt.id);
    const history = listAttemptsResponseSchema.parse(
      (await authed("get", `/quizzes/${quizId}/attempts`, token).expect(200)).body,
    );
    expect(history.attempts.map((item) => item.status)).toEqual(["in_progress", "submitted"]);
  });

  it("hides attempts from other accounts", async () => {
    const ownerToken = await register("teacher", "attempt-idor-owner@example.com");
    const strangerToken = await register("teacher", "attempt-idor-stranger@example.com");
    const { quizId } = await publishedQuiz(ownerToken);
    const attempt = await startAttempt(ownerToken, quizId);

    await authed("get", `/attempts/${attempt.id}`, strangerToken).expect(404);
    await authed("put", `/attempts/${attempt.id}/answers`, strangerToken)
      .send({ answers: [correctAnswers[0]] })
      .expect(404);
    await authed("post", `/attempts/${attempt.id}/submit`, strangerToken).send({}).expect(404);
    const history = listAttemptsResponseSchema.parse(
      (await authed("get", `/quizzes/${quizId}/attempts`, strangerToken).expect(200)).body,
    );
    expect(history.attempts).toEqual([]);
  });
});

describe("deadlines", () => {
  async function expire(attemptId: string) {
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { deadlineAt: new Date(Date.now() - 60_000) },
    });
  }

  it("auto-submits saved answers once the deadline has passed", async () => {
    const token = await register("self_learner", "attempt-expired@example.com");
    const { quizId } = await publishedQuiz(token, 5);
    const attempt = await startAttempt(token, quizId);
    await authed("put", `/attempts/${attempt.id}/answers`, token)
      .send({ answers: [correctAnswers[0]] })
      .expect(200);
    await expire(attempt.id);

    const late = await authed("put", `/attempts/${attempt.id}/answers`, token)
      .send({ answers: [correctAnswers[1]] })
      .expect(409);
    expect(errorResponseSchema.parse(late.body).code).toBe("CONFLICT");

    const reviewed = attemptResponseSchema.parse(
      (await authed("get", `/attempts/${attempt.id}`, token).expect(200)).body,
    ).attempt;
    expect(reviewed).toMatchObject({ status: "submitted", correctCount: 1, score: 33 });
  });

  it("ignores answers sent with a late submit and opens a fresh attempt", async () => {
    const token = await register("teacher", "attempt-late-submit@example.com");
    const { quizId } = await publishedQuiz(token, 5);
    const attempt = await startAttempt(token, quizId);
    await expire(attempt.id);

    const submitted = attemptResponseSchema.parse(
      (
        await authed("post", `/attempts/${attempt.id}/submit`, token)
          .send({ answers: correctAnswers })
          .expect(200)
      ).body,
    ).attempt;
    expect(submitted).toMatchObject({ status: "submitted", correctCount: 0, score: 0 });

    const expiredSecond = await startAttempt(token, quizId);
    await expire(expiredSecond.id);
    const fresh = await startAttempt(token, quizId);
    expect(fresh.id).not.toBe(expiredSecond.id);
    expect(
      (await prisma.quizAttempt.findUniqueOrThrow({ where: { id: expiredSecond.id } })).status,
    ).toBe("SUBMITTED");
  });
});
