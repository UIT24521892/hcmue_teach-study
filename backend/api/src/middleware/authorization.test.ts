import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { authSessionSchema, errorResponseSchema } from "@mach/contracts";

import { prisma } from "../lib/prisma.js";
import { createTestApp, TEST_ACCESS_TOKEN_SECRET } from "../test/app.js";
import { resetAuthTables } from "../test/database.js";
import { createAuthenticateMiddleware } from "./authenticate.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { requestContext } from "./request-context.js";
import { requireRole } from "./require-role.js";

const authApp = createTestApp();

/** A minimal surface used to exercise the middleware without a real feature. */
const guardedApp = express();
guardedApp.use(requestContext);
const authenticate = createAuthenticateMiddleware({
  accessTokenSecret: TEST_ACCESS_TOKEN_SECRET,
});
guardedApp.get("/teacher-only", authenticate, requireRole("teacher"), (_request, response) => {
  response.status(200).json({ ok: true });
});
guardedApp.get(
  "/learner-or-teacher",
  authenticate,
  requireRole("teacher", "self_learner"),
  (_request, response) => {
    response.status(200).json({ ok: true });
  },
);
guardedApp.use(notFoundHandler);
guardedApp.use(errorHandler);

const password = "matkhau-rat-dai-123";

async function accessTokenFor(
  role: "teacher" | "student" | "self_learner",
  email: string,
): Promise<string> {
  const response = await request(authApp)
    .post("/api/v1/auth/register")
    .send({ name: "Người dùng thử", email, password, role })
    .expect(201);

  return authSessionSchema.parse(response.body).accessToken;
}

beforeEach(async () => {
  await resetAuthTables();
});

describe("authenticate + requireRole", () => {
  it("lets the allowed role through", async () => {
    const token = await accessTokenFor("teacher", "teacher@example.com");

    await request(guardedApp)
      .get("/teacher-only")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
  });

  it("returns 403 for a signed-in user with the wrong role", async () => {
    const studentToken = await accessTokenFor("student", "student@example.com");
    const learnerToken = await accessTokenFor("self_learner", "learner@example.com");

    for (const token of [studentToken, learnerToken]) {
      const response = await request(guardedApp)
        .get("/teacher-only")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(errorResponseSchema.parse(response.body).code).toBe("FORBIDDEN");
    }
  });

  it("returns 401 before any role check when no session is present", async () => {
    const response = await request(guardedApp).get("/teacher-only").expect(401);

    expect(errorResponseSchema.parse(response.body).code).toBe("UNAUTHENTICATED");
  });

  it("accepts any role listed in the guard", async () => {
    const teacherToken = await accessTokenFor("teacher", "teacher2@example.com");
    const learnerToken = await accessTokenFor("self_learner", "learner2@example.com");
    const studentToken = await accessTokenFor("student", "student2@example.com");

    for (const token of [teacherToken, learnerToken]) {
      await request(guardedApp)
        .get("/learner-or-teacher")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    }

    await request(guardedApp)
      .get("/learner-or-teacher")
      .set("Authorization", `Bearer ${studentToken}`)
      .expect(403);
  });

  it("drops access as soon as the account is soft deleted", async () => {
    const token = await accessTokenFor("teacher", "teacher3@example.com");
    await prisma.user.update({
      where: { email: "teacher3@example.com" },
      data: { deletedAt: new Date() },
    });

    await request(guardedApp)
      .get("/teacher-only")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });
});
