import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const incomingId = request.header("x-request-id")?.trim();
  const requestId = incomingId && incomingId.length <= 128 ? incomingId : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader("x-request-id", requestId);
  next();
}
