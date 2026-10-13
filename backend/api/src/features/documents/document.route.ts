import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";

import {
  reviewQuestionRequestSchema,
  updateQuestionRequestSchema,
  type DocumentJob,
  type GetDocumentResponse,
  type ListDocumentJobsResponse,
  type ListDocumentsResponse,
  type ListQuestionsResponse,
  type ProcessDocumentResponse,
  type QuestionResponse,
  type UploadDocumentResponse,
} from "@mach/contracts";
import {
  createDocumentExtractor,
  createDocumentProcessor,
  MockQuestionGenerationProvider,
} from "@mach/document-pipeline";

import { HttpError } from "../../lib/http-error.js";
import { parseInput } from "../../lib/validate.js";
import { createAuthenticateMiddleware, getAuthContext } from "../../middleware/authenticate.js";
import { createRateLimiter, type RateLimitOptions } from "../../middleware/rate-limit.js";
import { requireRole } from "../../middleware/require-role.js";
import {
  BullMqDocumentJobDispatcher,
  InlineDocumentJobDispatcher,
  ManualDocumentJobDispatcher,
  type DocumentJobDispatcher,
} from "./document.dispatcher.js";
import { createDocumentJobService } from "./document-job.service.js";
import { documentPipelineRepository } from "./document.pipeline-repository.js";
import { createDocumentService } from "./document.service.js";
import { LocalStorageService } from "./document.storage.js";
import { createQuestionService } from "./question.service.js";

export interface DocumentRouterOptions {
  accessTokenSecret: string;
  localStoragePath: string;
  maxUploadBytes: number;
  maxExtractedCharacters: number;
  jobMode: "inline" | "redis" | "manual";
  redisUrl: string;
  jobMaxAttempts: number;
  jobBackoffMs: number;
  dailyAiQuota: number;
  targetQuestionCount: number;
  uploadRateLimit: RateLimitOptions;
  aiRateLimit: RateLimitOptions;
}

const documentParamsSchema = z.object({ documentId: z.string().uuid() });
const questionParamsSchema = documentParamsSchema.extend({ questionId: z.string().uuid() });
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
const questionQuerySchema = paginationQuerySchema.extend({
  status: z.enum(["pending_review", "approved", "rejected"]).optional(),
});

function receiveFile(
  upload: ReturnType<typeof multer>,
  request: Request,
  response: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single("file")(request, response, (error: unknown) => {
      if (!error) {
        resolve();
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          reject(HttpError.payloadTooLarge("File vượt quá dung lượng cho phép."));
          return;
        }

        reject(HttpError.badRequest("Multipart upload không hợp lệ.", { reason: error.code }));
        return;
      }

      reject(error);
    });
  });
}

export function createDocumentRouter(options: DocumentRouterOptions) {
  const router = Router();
  const authenticate = createAuthenticateMiddleware({
    accessTokenSecret: options.accessTokenSecret,
  });
  const allowedOwner = requireRole("teacher", "self_learner");
  const uploadLimiter = createRateLimiter(options.uploadRateLimit);
  const aiLimiter = createRateLimiter(options.aiRateLimit);
  const upload = multer({
    storage: multer.memoryStorage(),
    preservePath: true,
    limits: {
      fileSize: options.maxUploadBytes,
      files: 1,
      fields: 0,
      parts: 1,
    },
  });
  const storage = new LocalStorageService(options.localStoragePath);
  const service = createDocumentService({ storage });
  const processor = createDocumentProcessor({
    repository: documentPipelineRepository,
    storage,
    extractor: createDocumentExtractor({ maxCharacters: options.maxExtractedCharacters }),
    questionProvider: new MockQuestionGenerationProvider(),
    targetQuestionCount: options.targetQuestionCount,
  });
  let dispatcher: DocumentJobDispatcher;
  if (options.jobMode === "redis") {
    dispatcher = new BullMqDocumentJobDispatcher(
      options.redisUrl,
      options.jobMaxAttempts,
      options.jobBackoffMs,
    );
  } else if (options.jobMode === "inline") {
    dispatcher = new InlineDocumentJobDispatcher(
      processor,
      options.jobMaxAttempts,
      options.jobBackoffMs,
    );
  } else {
    dispatcher = new ManualDocumentJobDispatcher();
  }
  const jobService = createDocumentJobService({
    dispatcher,
    maxAttempts: options.jobMaxAttempts,
    dailyQuota: options.dailyAiQuota,
  });
  const questionService = createQuestionService();

  router.get("/", authenticate, allowedOwner, async (request, response) => {
    const query = parseInput(paginationQuerySchema, request.query);
    const auth = getAuthContext(response);
    const result = await service.listOwned(auth.userId, query.page ?? 1, query.pageSize ?? 12);
    response.status(200).json(result satisfies ListDocumentsResponse);
  });

  router.post(
    "/",
    authenticate,
    allowedOwner,
    uploadLimiter,
    aiLimiter,
    async (request, response) => {
      if (!request.is("multipart/form-data")) {
        throw HttpError.unsupportedMedia("Yêu cầu phải dùng multipart/form-data.");
      }

      await receiveFile(upload, request, response);
      if (!request.file) {
        throw HttpError.badRequest('Thiếu file trong trường multipart "file".');
      }

      const auth = getAuthContext(response);
      await jobService.assertWithinQuota(auth.userId);
      const uploaded = await service.upload(auth.userId, request.file);
      let job: DocumentJob;
      try {
        job = await jobService.enqueue(auth.userId, uploaded.id);
      } catch (enqueueError) {
        if (enqueueError instanceof HttpError && enqueueError.code === "QUOTA_EXCEEDED") {
          await service.removeOwned(auth.userId, uploaded.id);
        }
        throw enqueueError;
      }
      const document = await service.getOwned(auth.userId, uploaded.id);
      response.status(201).json({ document, job } satisfies UploadDocumentResponse);
    },
  );

  router.post(
    "/:documentId/process",
    authenticate,
    allowedOwner,
    aiLimiter,
    async (request, response) => {
      const { documentId } = parseInput(documentParamsSchema, request.params);
      const auth = getAuthContext(response);
      const job = await jobService.enqueue(auth.userId, documentId);
      const document = await service.getOwned(auth.userId, documentId);
      response.status(202).json({ document, job } satisfies ProcessDocumentResponse);
    },
  );

  router.get("/:documentId/jobs", authenticate, allowedOwner, async (request, response) => {
    const { documentId } = parseInput(documentParamsSchema, request.params);
    const auth = getAuthContext(response);
    const { jobs } = await jobService.getOwnedDocumentWithJobs(auth.userId, documentId);
    response.status(200).json({ jobs } satisfies ListDocumentJobsResponse);
  });

  router.get("/:documentId/questions", authenticate, allowedOwner, async (request, response) => {
    const { documentId } = parseInput(documentParamsSchema, request.params);
    const query = parseInput(questionQuerySchema, request.query);
    const auth = getAuthContext(response);
    await service.getOwned(auth.userId, documentId);
    const result = await questionService.listOwned(auth.userId, documentId, {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 12,
      ...(query.status ? { status: query.status } : {}),
    });
    response.status(200).json(result satisfies ListQuestionsResponse);
  });

  router.patch(
    "/:documentId/questions/:questionId",
    authenticate,
    allowedOwner,
    async (request, response) => {
      const { documentId, questionId } = parseInput(questionParamsSchema, request.params);
      const input = parseInput(updateQuestionRequestSchema, request.body);
      const auth = getAuthContext(response);
      const question = await questionService.updateOwned(
        auth.userId,
        documentId,
        questionId,
        input,
      );
      response.status(200).json({ question } satisfies QuestionResponse);
    },
  );

  router.post(
    "/:documentId/questions/:questionId/review",
    authenticate,
    allowedOwner,
    async (request, response) => {
      const { documentId, questionId } = parseInput(questionParamsSchema, request.params);
      const input = parseInput(reviewQuestionRequestSchema, request.body);
      const auth = getAuthContext(response);
      const question = await questionService.reviewOwned(
        auth.userId,
        documentId,
        questionId,
        input,
      );
      response.status(200).json({ question } satisfies QuestionResponse);
    },
  );

  router.get("/:documentId", authenticate, allowedOwner, async (request, response) => {
    const { documentId } = parseInput(documentParamsSchema, request.params);
    const auth = getAuthContext(response);
    const document = await service.getOwned(auth.userId, documentId);

    response.status(200).json({ document } satisfies GetDocumentResponse);
  });

  return Object.assign(router, { closeResources: () => dispatcher.close() });
}
