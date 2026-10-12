import type { NextFunction, Request, Response } from "express";

import type { ErrorResponse } from "@mach/contracts";

import { HttpError } from "../lib/http-error.js";

export function requestIdOf(response: Response): string {
  const requestId = (response.locals as { requestId?: unknown }).requestId;

  return typeof requestId === "string" && requestId.length > 0 ? requestId : "unknown";
}

export function notFoundHandler(request: Request, response: Response): void {
  const body: ErrorResponse = {
    code: "NOT_FOUND",
    message: `Không tìm thấy ${request.method} ${request.path}`,
    requestId: requestIdOf(response),
  };

  response.status(404).json(body);
}

/**
 * Single place where errors become HTTP responses. Unexpected failures are
 * logged as metadata only — never request bodies, tokens or document content —
 * and the client receives a generic message.
 */
export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  const requestId = requestIdOf(response);

  if (error instanceof HttpError) {
    const body: ErrorResponse = {
      code: error.code,
      message: error.message,
      requestId,
      ...(error.details === undefined ? {} : { details: error.details }),
    };

    response.status(error.status).json(body);
    return;
  }

  console.error(
    JSON.stringify({
      level: "error",
      message: "Unhandled request error",
      requestId,
      error: error instanceof Error ? error.name : "UnknownError",
    }),
  );

  const body: ErrorResponse = {
    code: "INTERNAL_ERROR",
    message: "Đã có lỗi xảy ra. Vui lòng thử lại.",
    requestId,
  };

  response.status(500).json(body);
}
