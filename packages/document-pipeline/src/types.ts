export const supportedDocumentExtensions = [
  "pdf",
  "docx",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export const DOCUMENT_PIPELINE_QUEUE_NAME = "document-pipeline";

export type SupportedDocumentExtension = (typeof supportedDocumentExtensions)[number];

export interface SourceDocument {
  id: string;
  storageKey: string;
  originalName: string;
  extension: SupportedDocumentExtension;
  mimeType: string;
}

export interface ExtractedDocument {
  text: string;
  characterCount: number;
  pageCount: number | null;
}

export interface DocumentStorageReader {
  read(key: string): Promise<Buffer>;
}

export interface DocumentPipelineJob {
  id: string;
  document: SourceDocument;
  attempt: number;
  maxAttempts: number;
}

export interface DocumentPipelineRepository {
  claim(jobId: string): Promise<DocumentPipelineJob | null>;
  setProgress(jobId: string, progress: number): Promise<void>;
  complete(
    job: DocumentPipelineJob,
    extracted: ExtractedDocument,
    questions: GeneratedQuestion[],
  ): Promise<void>;
  fail(
    job: DocumentPipelineJob,
    error: { code: string; message: string; retryable: boolean },
  ): Promise<void>;
}

export interface GeneratedQuestion {
  type: "multiple_choice" | "fill_blank" | "true_false";
  prompt: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuestionGenerationInput {
  documentId: string;
  sourceText: string;
  targetQuestionCount: number;
}

export interface QuestionGenerationProvider {
  readonly name: string;
  generate(input: QuestionGenerationInput): Promise<unknown>;
}
