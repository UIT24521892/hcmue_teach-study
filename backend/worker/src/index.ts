import { PrismaClient } from "@prisma/client";
import { UnrecoverableError, Worker } from "bullmq";
import { Redis } from "ioredis";

import {
  createDocumentExtractor,
  createDocumentProcessor,
  createPrismaDocumentPipelineRepository,
  DOCUMENT_PIPELINE_QUEUE_NAME,
  DocumentPipelineError,
  MockQuestionGenerationProvider,
} from "@mach/document-pipeline";

import { loadWorkerConfig } from "./config.js";
import { LocalDocumentStorageReader } from "./storage.js";

const config = loadWorkerConfig();
const prisma = new PrismaClient({
  log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const processor = createDocumentProcessor({
  repository: createPrismaDocumentPipelineRepository(prisma),
  storage: new LocalDocumentStorageReader(config.STORAGE_LOCAL_PATH),
  extractor: createDocumentExtractor({
    maxCharacters: config.DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS,
  }),
  questionProvider: new MockQuestionGenerationProvider(),
  targetQuestionCount: config.DOCUMENT_TARGET_QUESTION_COUNT,
});

const worker = new Worker<{ jobId: string }>(
  DOCUMENT_PIPELINE_QUEUE_NAME,
  async (job) => {
    try {
      await processor.process(job.data.jobId);
    } catch (error) {
      if (error instanceof DocumentPipelineError && !error.retryable) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  },
  { connection, concurrency: 2 },
);

worker.on("ready", () => {
  console.info(JSON.stringify({ level: "info", message: "Document worker ready" }));
});

worker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      message: "Document job attempt failed",
      jobId: job?.id ?? "unknown",
      attempt: job?.attemptsMade ?? 0,
      error: error.name,
    }),
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.info(JSON.stringify({ level: "info", message: "Worker shutting down", signal }));
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
