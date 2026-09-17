import { z } from "zod";

const webEnvSchema = z.object({
  VITE_API_URL: z.string().url().default("http://localhost:4000/api/v1"),
});

const result = webEnvSchema.safeParse(import.meta.env);

if (!result.success) {
  const issues = result.error.issues.map((issue) => issue.message).join("; ");
  throw new Error(`Invalid web environment: ${issues}`);
}

export const webEnv = result.data;
