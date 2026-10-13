import type { ErrorCode } from "@mach/contracts";

/**
 * Error type that carries the HTTP status and the public error code. Anything
 * thrown that is not an `HttpError` is treated as an unexpected failure and is
 * reported as INTERNAL_ERROR without leaking the original message.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): HttpError {
    return new HttpError(400, "VALIDATION_ERROR", message, details);
  }

  static unauthenticated(message = "Bạn cần đăng nhập để tiếp tục."): HttpError {
    return new HttpError(401, "UNAUTHENTICATED", message);
  }

  static forbidden(message = "Bạn không có quyền thực hiện thao tác này."): HttpError {
    return new HttpError(403, "FORBIDDEN", message);
  }

  static payloadTooLarge(message: string): HttpError {
    return new HttpError(413, "PAYLOAD_TOO_LARGE", message);
  }

  static unsupportedMedia(message: string): HttpError {
    return new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", message);
  }

  static notFound(message = "Không tìm thấy dữ liệu."): HttpError {
    return new HttpError(404, "NOT_FOUND", message);
  }

  static conflict(message: string, details?: unknown): HttpError {
    return new HttpError(409, "CONFLICT", message, details);
  }

  static quotaExceeded(message: string, details?: unknown): HttpError {
    return new HttpError(429, "QUOTA_EXCEEDED", message, details);
  }

  static serviceUnavailable(message: string): HttpError {
    return new HttpError(503, "SERVICE_UNAVAILABLE", message);
  }

  static sessionRefreshConflict(retryAfterMs: number): HttpError {
    return new HttpError(
      409,
      "SESSION_REFRESH_CONFLICT",
      "Phiên đăng nhập vừa được làm mới ở yêu cầu khác. Vui lòng thử lại.",
      { retryAfterMs },
    );
  }
}
