import { z } from "zod";

/**
 * Canonical error codes returned by the API. Every error response uses the same
 * envelope so the web client can branch on `code` without parsing messages.
 */
export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "SESSION_REFRESH_CONFLICT",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "SERVICE_UNAVAILABLE",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  details: z.unknown().optional(),
  requestId: z.string().min(1),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
