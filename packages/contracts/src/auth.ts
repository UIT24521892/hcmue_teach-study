import { z } from "zod";

/** Roles the platform understands. Mirrors the Prisma `UserRole` enum in lower case. */
export const userRoleSchema = z.enum(["teacher", "student", "self_learner", "admin"]);

export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * `admin` is a schema-level extension for later phases. It must never be
 * self-assignable through public registration.
 */
export const selfRegisterableRoleSchema = z.enum(["teacher", "student", "self_learner"]);

export type SelfRegisterableRole = z.infer<typeof selfRegisterableRoleSchema>;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email("Email không hợp lệ.");

/** IANA timezone identifier, e.g. `Asia/Ho_Chi_Minh` or `UTC`. */
export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/, "Múi giờ không hợp lệ.");

export const passwordSchema = z
  .string()
  .min(10, "Mật khẩu cần ít nhất 10 ký tự.")
  .max(200, "Mật khẩu quá dài.");

export const registerRequestSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên.").max(120),
  email: emailSchema,
  password: passwordSchema,
  role: selfRegisterableRoleSchema,
  timezone: timezoneSchema.optional(),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(200),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Public projection of a user. Never contains password or token material. */
export const authUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(3),
  role: userRoleSchema,
  timezone: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type AuthUser = z.infer<typeof authUserSchema>;

/**
 * The refresh token itself is never part of the body: it travels in an
 * httpOnly cookie so browser scripts cannot read it.
 */
export const authSessionSchema = z.object({
  user: authUserSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.string().datetime(),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

export const authMeResponseSchema = z.object({
  user: authUserSchema,
});

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;

export const logoutResponseSchema = z.object({
  success: z.literal(true),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
