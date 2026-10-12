import type { z } from "zod";

import { HttpError } from "./http-error.js";

/**
 * Validates untrusted input at the HTTP boundary. Field-level issues are
 * returned in `details` so the client can highlight the offending inputs.
 */
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  message = "Dữ liệu gửi lên không hợp lệ.",
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw HttpError.badRequest(message, result.error.flatten().fieldErrors);
  }

  return result.data;
}
