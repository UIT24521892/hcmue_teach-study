import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  authMeResponseSchema,
  authSessionSchema,
  errorResponseSchema,
  listNotesResponseSchema,
  noteResponseSchema,
  studyProgressResponseSchema,
  uploadDocumentResponseSchema,
} from "@mach/contracts";

import { localDateKey, shiftDateKey } from "../../lib/local-date.js";
import { prisma } from "../../lib/prisma.js";
import { createTestApp, TEST_STORAGE_PATH } from "../../test/app.js";
import { resetAuthTables } from "../../test/database.js";

const app = createTestApp();
const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF", "utf8");
const TIME_ZONE = "Asia/Ho_Chi_Minh";

async function register(role: "teacher" | "student" | "self_learner", email: string) {
  const response = await request(app)
    .post("/api/v1/auth/register")
    .send({ name: `User ${role}`, email, password: "matkhau-rat-dai-123", role })
    .expect(201);
  const token = authSessionSchema.parse(response.body).accessToken;
  const me = authMeResponseSchema.parse(
    (await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${token}`)).body,
  );
  await prisma.user.update({ where: { id: me.user.id }, data: { timezone: TIME_ZONE } });
  return { token, userId: me.user.id };
}

function authed(method: "get" | "put" | "delete" | "post", path: string, token: string) {
  return request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
}

const today = () => localDateKey(new Date(), TIME_ZONE);

/** A submitted attempt on a minimal quiz, submitted at `submittedAt`. */
async function submittedAttempt(userId: string, submittedAt: Date, score = 80) {
  const quiz = await prisma.quiz.create({
    data: { id: randomUUID(), ownerId: userId, title: "Unit 3 check", status: "PUBLISHED" },
  });
  return prisma.quizAttempt.create({
    data: {
      id: randomUUID(),
      quizId: quiz.id,
      userId,
      status: "SUBMITTED",
      items: [],
      totalCount: 1,
      score,
      correctCount: 1,
      submittedAt,
    },
  });
}

beforeEach(async () => {
  await resetAuthTables();
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(TEST_STORAGE_PATH, { recursive: true, force: true });
});

describe("daily notes", () => {
  it("creates, updates with a version, lists and deletes one note per day", async () => {
    const { token } = await register("student", "notes-crud@example.com");
    const date = today();

    const created = await authed("put", `/notes/${date}`, token)
      .send({ content: "  New word: resilient  ", understanding: 2, tags: ["Vocabulary"] })
      .expect(201);
    const note = noteResponseSchema.parse(created.body).note;
    expect(note).toMatchObject({
      date,
      content: "New word: resilient",
      understanding: 2,
      tags: ["Vocabulary"],
      version: 1,
    });

    const blind = await authed("put", `/notes/${date}`, token)
      .send({ content: "Overwrite", understanding: 1 })
      .expect(409);
    expect(errorResponseSchema.parse(blind.body).details).toEqual({ currentVersion: 1 });

    const updated = noteResponseSchema.parse(
      (
        await authed("put", `/notes/${date}`, token)
          .send({
            content: "Resilient = kiên cường",
            understanding: 3,
            tags: ["vocabulary", "Reading"],
            version: 1,
          })
          .expect(200)
      ).body,
    ).note;
    // "vocabulary" reuses the existing tag and keeps its first spelling.
    expect(updated).toMatchObject({ version: 2, tags: ["Reading", "Vocabulary"] });
    expect(await prisma.tag.count()).toBe(2);

    const list = listNotesResponseSchema.parse(
      (await authed("get", `/notes?from=${shiftDateKey(date, -30)}&to=${date}`, token).expect(200))
        .body,
    );
    expect(list.notes.map((entry) => entry.date)).toEqual([date]);

    await authed("delete", `/notes/${date}?version=1`, token).expect(409);
    await authed("delete", `/notes/${date}?version=2`, token).expect(204);
    await authed("delete", `/notes/${date}?version=2`, token).expect(404);
  });

  it("rejects future days, impossible dates and oversized ranges", async () => {
    const { token } = await register("self_learner", "notes-validation@example.com");
    const tomorrow = shiftDateKey(today(), 1);

    await authed("put", `/notes/${tomorrow}`, token)
      .send({ content: "Too early", understanding: 2 })
      .expect(400);
    await authed("put", "/notes/2026-02-30", token)
      .send({ content: "No such day", understanding: 2 })
      .expect(400);
    await authed("put", `/notes/${today()}`, token)
      .send({ content: "Bad scale", understanding: 5 })
      .expect(400);
    await authed("get", "/notes?from=2026-01-01&to=2026-12-31", token).expect(400);
    await request(app).get(`/api/v1/notes?from=${today()}&to=${today()}`).expect(401);
  });

  it("keeps notes private between accounts", async () => {
    const owner = await register("student", "notes-owner@example.com");
    const teacher = await register("teacher", "notes-teacher@example.com");
    const date = today();
    await authed("put", `/notes/${date}`, owner.token)
      .send({ content: "Private reflection", understanding: 1 })
      .expect(201);

    const teacherView = listNotesResponseSchema.parse(
      (await authed("get", `/notes?from=${date}&to=${date}`, teacher.token).expect(200)).body,
    );
    expect(teacherView.notes).toEqual([]);
    // The same day is a separate page for another user, not a conflict.
    await authed("put", `/notes/${date}`, teacher.token)
      .send({ content: "Teacher journal", understanding: 3 })
      .expect(201);
    await authed("delete", `/notes/${date}?version=1`, teacher.token).expect(204);
    expect(await prisma.dailyNote.count({ where: { userId: owner.userId } })).toBe(1);
  });
});

describe("note links", () => {
  it("links only the author's own documents and submitted attempts", async () => {
    const owner = await register("teacher", "links-owner@example.com");
    const stranger = await register("teacher", "links-stranger@example.com");
    const upload = (token: string) =>
      authed("post", "/documents", token)
        .attach("file", PDF, { filename: "unit.pdf", contentType: "application/pdf" })
        .expect(201);
    const ownDocument = uploadDocumentResponseSchema.parse((await upload(owner.token)).body);
    const foreignDocument = uploadDocumentResponseSchema.parse((await upload(stranger.token)).body);
    const attempt = await submittedAttempt(owner.userId, new Date(), 75);
    const date = today();

    const linked = noteResponseSchema.parse(
      (
        await authed("put", `/notes/${date}`, owner.token)
          .send({
            content: "Practised Unit 3",
            understanding: 2,
            documentIds: [ownDocument.document.id],
            attemptIds: [attempt.id],
          })
          .expect(201)
      ).body,
    ).note;
    expect(linked.links).toEqual([
      { kind: "document", id: ownDocument.document.id, title: "unit.pdf" },
      { kind: "attempt", id: attempt.id, title: "Unit 3 check", score: 75 },
    ]);

    await authed("put", `/notes/${date}`, owner.token)
      .send({
        content: "Probe",
        understanding: 2,
        documentIds: [foreignDocument.document.id],
        version: 1,
      })
      .expect(404);
    const strangerAttempt = await submittedAttempt(stranger.userId, new Date());
    await authed("put", `/notes/${date}`, owner.token)
      .send({ content: "Probe", understanding: 2, attemptIds: [strangerAttempt.id], version: 1 })
      .expect(404);

    await prisma.document.update({
      where: { id: ownDocument.document.id },
      data: { deletedAt: new Date() },
    });
    const reread = listNotesResponseSchema.parse(
      (await authed("get", `/notes?from=${date}&to=${date}`, owner.token).expect(200)).body,
    );
    expect(reread.notes[0]?.links.map((link) => link.kind)).toEqual(["attempt"]);
  });
});

describe("study progress", () => {
  it("counts one session per local day and keeps the streak across the midnight boundary", async () => {
    const { token, userId } = await register("self_learner", "progress@example.com");
    const day0 = today();
    for (const offset of [0, -1, -5]) {
      await prisma.dailyNote.create({
        data: {
          userId,
          date: new Date(`${shiftDateKey(day0, offset)}T00:00:00.000Z`),
          content: "Studied",
          understanding: 2,
        },
      });
    }
    // 00:30 local on day -2 is still the previous day in UTC (UTC+7 offset).
    const twoDaysAgo = shiftDateKey(day0, -2);
    const justAfterMidnight = new Date(`${shiftDateKey(twoDaysAgo, -1)}T17:30:00.000Z`);
    await submittedAttempt(userId, justAfterMidnight);
    await submittedAttempt(userId, new Date(justAfterMidnight.getTime() + 60 * 60_000));
    // An attempt on a day that already has a note adds no extra leaf.
    await submittedAttempt(userId, new Date());

    const progress = studyProgressResponseSchema.parse(
      (await authed("get", "/notes/progress", token).expect(200)).body,
    ).progress;
    expect(progress).toEqual({
      timezone: TIME_ZONE,
      today: day0,
      completedSessions: 4,
      streakDays: 3,
    });
  });
});
