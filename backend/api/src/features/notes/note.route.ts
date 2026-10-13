import { Router } from "express";
import { z } from "zod";

import {
  dateKeySchema,
  listNotesQuerySchema,
  upsertNoteRequestSchema,
  type ListNotesResponse,
  type NoteResponse,
  type StudyProgressResponse,
} from "@mach/contracts";

import { parseInput } from "../../lib/validate.js";
import { createAuthenticateMiddleware, getAuthContext } from "../../middleware/authenticate.js";
import { createNoteService } from "./note.service.js";

export interface NoteRouterOptions {
  accessTokenSecret: string;
}

const dateParamsSchema = z.object({ date: dateKeySchema });
const deleteQuerySchema = z.object({ version: z.coerce.number().int().positive() });

/**
 * Private learning journal. Every role keeps notes; every query is scoped to
 * the signed-in user, so teachers never read students' notes by default.
 */
export function createNoteRouter(options: NoteRouterOptions) {
  const router = Router();
  const service = createNoteService();
  router.use(createAuthenticateMiddleware({ accessTokenSecret: options.accessTokenSecret }));

  router.get("/", async (request, response) => {
    const { from, to } = parseInput(listNotesQuerySchema, request.query);
    const auth = getAuthContext(response);
    const notes = await service.list(auth.userId, from, to);
    response.status(200).json({ notes } satisfies ListNotesResponse);
  });

  router.get("/progress", async (_request, response) => {
    const auth = getAuthContext(response);
    const progress = await service.progress(auth.userId);
    response.status(200).json({ progress } satisfies StudyProgressResponse);
  });

  router.put("/:date", async (request, response) => {
    const { date } = parseInput(dateParamsSchema, request.params);
    const input = parseInput(upsertNoteRequestSchema, request.body);
    const auth = getAuthContext(response);
    const { note, created } = await service.upsert(auth.userId, date, input);
    response.status(created ? 201 : 200).json({ note } satisfies NoteResponse);
  });

  router.delete("/:date", async (request, response) => {
    const { date } = parseInput(dateParamsSchema, request.params);
    const { version } = parseInput(deleteQuerySchema, request.query);
    const auth = getAuthContext(response);
    await service.remove(auth.userId, date, version);
    response.status(204).end();
  });

  return router;
}
