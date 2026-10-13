import { DocumentPipelineError, toSafePipelineError } from "./errors.js";
import { generateValidatedQuestions } from "./question-provider.js";
import type { DocumentExtractor } from "./extractor.js";
import type {
  DocumentPipelineRepository,
  DocumentStorageReader,
  QuestionGenerationProvider,
} from "./types.js";

export interface DocumentProcessorDependencies {
  repository: DocumentPipelineRepository;
  storage: DocumentStorageReader;
  extractor: DocumentExtractor;
  questionProvider: QuestionGenerationProvider;
  targetQuestionCount: number;
}

export function createDocumentProcessor(dependencies: DocumentProcessorDependencies) {
  return {
    async process(jobId: string): Promise<void> {
      const job = await dependencies.repository.claim(jobId);
      if (!job) return;

      try {
        let file: Buffer;
        try {
          file = await dependencies.storage.read(job.document.storageKey);
        } catch (error) {
          throw new DocumentPipelineError(
            "STORAGE_READ_FAILED",
            "Không thể đọc file tài liệu từ kho lưu trữ.",
            { retryable: true, cause: error },
          );
        }

        await dependencies.repository.setProgress(job.id, 20);
        const extracted = await dependencies.extractor.extract(job.document, file);
        await dependencies.repository.setProgress(job.id, 55);
        const questions = await generateValidatedQuestions(dependencies.questionProvider, {
          documentId: job.document.id,
          sourceText: extracted.text,
          targetQuestionCount: dependencies.targetQuestionCount,
        });
        await dependencies.repository.setProgress(job.id, 90);
        await dependencies.repository.complete(job, extracted, questions);
      } catch (error) {
        const safeError = toSafePipelineError(error);
        await dependencies.repository.fail(job, {
          code: safeError.code,
          message: safeError.message,
          retryable: safeError.retryable,
        });
        throw safeError;
      }
    },
  };
}

export type DocumentProcessor = ReturnType<typeof createDocumentProcessor>;
