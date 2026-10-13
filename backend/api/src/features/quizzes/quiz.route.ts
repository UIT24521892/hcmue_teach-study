import { Router } from "express";
import { z } from "zod";

import {
  createQuizRequestSchema,
  quizStatusSchema,
  quizTransitionRequestSchema,
  updateQuizRequestSchema,
  type ListQuizzesResponse,
  type QuizResponse,
} from "@mach/contracts";

import { parseInput } from "../../lib/validate.js";
import { createAuthenticateMiddleware, getAuthContext } from "../../middleware/authenticate.js";
import { requireRole } from "../../middleware/require-role.js";
import { createQuizService } from "./quiz.service.js";

export interface QuizRouterOptions {
  accessTokenSecret: string;
}

const quizParamsSchema = z.object({ quizId: z.string().uuid() });
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  status: quizStatusSchema.optional(),
});

/**
 * Quiz authoring for question-bank owners. Students reach published quizzes
 * only through assignments (Phase 5), never through these owner routes.
 */
export function createQuizRouter(options: QuizRouterOptions) {
  const router = Router();
  const authenticate = createAuthenticateMiddleware({
    accessTokenSecret: options.accessTokenSecret,
  });
  const allowedOwner = requireRole("teacher", "self_learner");
  const service = createQuizService();

  router.use(authenticate, allowedOwner);

  router.get("/", async (request, response) => {
    const query = parseInput(listQuerySchema, request.query);
    const auth = getAuthContext(response);
    const result = await service.listOwned(auth.userId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      ...(query.status ? { status: query.status } : {}),
    });
    response.status(200).json(result satisfies ListQuizzesResponse);
  });

  router.post("/", async (request, response) => {
    const input = parseInput(createQuizRequestSchema, request.body);
    const auth = getAuthContext(response);
    const quiz = await service.create(auth.userId, input);
    response.status(201).json({ quiz } satisfies QuizResponse);
  });

  router.get("/:quizId", async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const auth = getAuthContext(response);
    const quiz = await service.getOwned(auth.userId, quizId);
    response.status(200).json({ quiz } satisfies QuizResponse);
  });

  router.patch("/:quizId", async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const input = parseInput(updateQuizRequestSchema, request.body);
    const auth = getAuthContext(response);
    const quiz = await service.updateDraft(auth.userId, quizId, input);
    response.status(200).json({ quiz } satisfies QuizResponse);
  });

  router.post("/:quizId/publish", async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const { version } = parseInput(quizTransitionRequestSchema, request.body);
    const auth = getAuthContext(response);
    const quiz = await service.publish(auth.userId, quizId, version);
    response.status(200).json({ quiz } satisfies QuizResponse);
  });

  router.post("/:quizId/archive", async (request, response) => {
    const { quizId } = parseInput(quizParamsSchema, request.params);
    const { version } = parseInput(quizTransitionRequestSchema, request.body);
    const auth = getAuthContext(response);
    const quiz = await service.archive(auth.userId, quizId, version);
    response.status(200).json({ quiz } satisfies QuizResponse);
  });

  return router;
}
