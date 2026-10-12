export type DocumentPipelineErrorCode =
  | "CONTENT_EMPTY"
  | "CONTENT_TOO_LONG"
  | "EXTRACTION_FAILED"
  | "PROVIDER_FAILED"
  | "PROVIDER_INVALID_OUTPUT"
  | "STORAGE_READ_FAILED";

export class DocumentPipelineError extends Error {
  readonly code: DocumentPipelineErrorCode;
  readonly retryable: boolean;

  constructor(
    code: DocumentPipelineErrorCode,
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "DocumentPipelineError";
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}

export function toSafePipelineError(error: unknown): DocumentPipelineError {
  if (error instanceof DocumentPipelineError) {
    return error;
  }

  return new DocumentPipelineError(
    "EXTRACTION_FAILED",
    "Không thể xử lý nội dung tài liệu. Vui lòng kiểm tra file rồi thử lại.",
    { retryable: true, cause: error },
  );
}
