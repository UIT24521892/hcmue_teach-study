import { Queue } from "bullmq";
import { Redis } from "ioredis";

import {
  DOCUMENT_PIPELINE_QUEUE_NAME,
  DocumentPipelineError,
  type DocumentProcessor,
} from "@mach/document-pipeline";

export interface DocumentJobDispatcher {
  dispatch(jobId: string): Promise<void>;
  close(): Promise<void>;
}

export class ManualDocumentJobDispatcher implements DocumentJobDispatcher {
  async dispatch(): Promise<void> {
    // Tests can drive the processor explicitly without a timer racing database cleanup.
  }

  async close(): Promise<void> {}
}

export class InlineDocumentJobDispatcher implements DocumentJobDispatcher {
  constructor(
    private readonly processor: DocumentProcessor,
    private readonly maxAttempts: number,
    private readonly backoffMs: number,
  ) {}

  async dispatch(jobId: string): Promise<void> {
    const run = async (dispatchAttempt: number) => {
      try {
        await this.processor.process(jobId);
      } catch (error) {
        if (
          error instanceof DocumentPipelineError &&
          error.retryable &&
          dispatchAttempt < this.maxAttempts
        ) {
          const delay = this.backoffMs * 2 ** Math.max(0, dispatchAttempt - 1);
          setTimeout(() => void run(dispatchAttempt + 1), delay).unref();
        }
      }
    };

    setImmediate(() => void run(1));
  }

  async close(): Promise<void> {}
}

export class BullMqDocumentJobDispatcher implements DocumentJobDispatcher {
  private readonly connection: Redis;
  private readonly queue: Queue<{ jobId: string }>;

  constructor(
    redisUrl: string,
    private readonly maxAttempts: number,
    private readonly backoffMs: number,
  ) {
    this.connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue(DOCUMENT_PIPELINE_QUEUE_NAME, { connection: this.connection });
  }

  async dispatch(jobId: string): Promise<void> {
    await this.queue.add(
      "extract-and-generate",
      { jobId },
      {
        jobId,
        attempts: this.maxAttempts,
        backoff: { type: "exponential", delay: this.backoffMs },
        removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
      },
    );
  }

  async close(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
