import { Router } from "express";
import { z } from "zod";

import {
  saveAttemptAnswersRequestSchema,
  submitAttemptRequestSchema,
  type AttemptResponse,
  type ListAttemptsResponse,
} from "@mach/contracts";

import { parseInput } from "../../lib/validate.js";
import { createAuthenticateMiddleware, getAuthContext } from "../../middleware/authenticate.js";
import { createAttemptService } from "./attempt.service.js";

export interface AttemptRouterOptions {
  accessTokenSecret: string;
}

const quizParamsSchema = z.object({ quizId: z.string().uuid() });
const attemptParamsSchema = z.object({ attemptId: z.string().uuid() });
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
const ownListQuerySchema = listQuerySchema.extend({ status: z.literal("submitted").optional() });

/**
 * Taking quizzes. Any signed-in role may call these routes; the service
 * decides which quiz a user may attempt and scopes every attempt to its owner.
 * Mounted at `/api/v1` before the owner-only quiz authoring router.
 */
export function createAttemptRouter(options: AttemptRouterOptions) {
  const router = Router();
  const authenticate = createAuthenticateMiddleware({
    accessTokenSecret: options.accessTokenSecret,
  });
  const service = createAttemptService();

  router.post("/quizzes/:quizId/attempts", authenticate, async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const auth = getAuthContext(response);
    const { attempt, created } = await service.start(auth.userId, quizId);
    response.status(created ? 201 : 200).json({ attempt } satisfies AttemptResponse);
  });

  router.get("/quizzes/:quizId/attempts", authenticate, async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const query = parseInput(listQuerySchema, request.query);
    const auth = getAuthContext(response);
    const result = await service.listOwned(auth.userId, {
      quizId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
    });
    response.status(200).json(result satisfies ListAttemptsResponse);
  });

  router.get("/attempts", authenticate, async (request, response) => {
    const query = parseInput(ownListQuerySchema, request.query);
    const auth = getAuthContext(response);
    const result = await service.listOwned(auth.userId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 10,
      ...(query.status ? { submittedOnly: true } : {}),
    });
    response.status(200).json(result satisfies ListAttemptsResponse);
  });

  router.get("/attempts/:attemptId", authenticate, async (request, response) => {
    const { attemptId } = parseInput(attemptParamsSchema, request.params);
    const auth = getAuthContext(response);
    const attempt = await service.get(auth.userId, attemptId);
    response.status(200).json({ attempt } satisfies AttemptResponse);
  });

  router.put("/attempts/:attemptId/answers", authenticate, async (request, response) => {
    const { attemptId } = parseInput(attemptParamsSchema, request.params);
    const { answers } = parseInput(saveAttemptAnswersRequestSchema, request.body);
    const auth = getAuthContext(response);
    const attempt = await service.saveAnswers(auth.userId, attemptId, answers);
    response.status(200).json({ attempt } satisfies AttemptResponse);
  });

  router.post("/attempts/:attemptId/submit", authenticate, async (request, response) => {
    const { attemptId } = parseInput(attemptParamsSchema, request.params);
    const { answers } = parseInput(submitAttemptRequestSchema, request.body ?? {});
    const auth = getAuthContext(response);
    const attempt = await service.submit(auth.userId, attemptId, answers);
    response.status(200).json({ attempt } satisfies AttemptResponse);
  });

  return router;
}
