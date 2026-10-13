import type { z } from "zod";

import { HttpError } from "./http-error.js";

/**
 * Validates untrusted input at the HTTP boundary. Field-level issues are
 * returned in `details` so the client can highlight the offending inputs.
 */
export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown,
  message = "Dữ liệu gửi lên không hợp lệ.",
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw HttpError.badRequest(message, result.error.flatten().fieldErrors);
  }

  return result.data;
}
