import { z } from "zod";

import { timezoneSchema } from "./auth.js";

/** Calendar day `YYYY-MM-DD` that actually exists (no 2026-02-30). */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có dạng YYYY-MM-DD.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Ngày không tồn tại.");

/** 1 = cần ôn thêm, 2 = khá ổn, 3 = rất tự tin. */
export const understandingSchema = z.number().int().min(1).max(3);

export const tagNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^,]+$/, "Tag không được chứa dấu phẩy.");

export const noteLinkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document"), id: z.string().uuid(), title: z.string().min(1) }),
  z.object({
    kind: z.literal("attempt"),
    id: z.string().uuid(),
    title: z.string().min(1),
    score: z.number().int().min(0).max(100).nullable(),
  }),
]);

export const dailyNoteSchema = z.object({
  id: z.string().uuid(),
  date: dateKeySchema,
  content: z.string().min(1).max(5_000),
  understanding: understandingSchema,
  tags: z.array(z.string().min(1).max(40)).max(10),
  links: z.array(noteLinkSchema).max(20),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const uniqueIds = (ids: string[]) => new Set(ids).size === ids.length;

export const upsertNoteRequestSchema = z.object({
  content: z.string().trim().min(1, "Hãy ghi lại ít nhất một điều đã học.").max(5_000),
  understanding: understandingSchema,
  tags: z
    .array(tagNameSchema)
    .max(10)
    .refine(
      (tags) => new Set(tags.map((tag) => tag.toLocaleLowerCase("vi"))).size === tags.length,
      { message: "Tag bị trùng." },
    )
    .default([]),
  documentIds: z.array(z.string().uuid()).max(10).refine(uniqueIds).default([]),
  attemptIds: z.array(z.string().uuid()).max(10).refine(uniqueIds).default([]),
  /** Required when the day already has a note; omitted when creating one. */
  version: z.number().int().positive().optional(),
});

export const listNotesQuerySchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .refine((range) => range.from <= range.to, { message: "Khoảng ngày không hợp lệ." })
  .refine((range) => Date.parse(range.to) - Date.parse(range.from) <= 62 * 86_400_000, {
    message: "Chỉ lấy tối đa 63 ngày mỗi lần.",
  });

export const studyProgressSchema = z.object({
  timezone: timezoneSchema,
  /** Today in the user's timezone, as decided by the server. */
  today: dateKeySchema,
  /** Distinct days with a note or a submitted quiz attempt. */
  completedSessions: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
});

export const noteResponseSchema = z.object({ note: dailyNoteSchema });
export const listNotesResponseSchema = z.object({ notes: z.array(dailyNoteSchema) });
export const studyProgressResponseSchema = z.object({ progress: studyProgressSchema });

export type DateKey = z.infer<typeof dateKeySchema>;
export type NoteLink = z.infer<typeof noteLinkSchema>;
export type DailyNote = z.infer<typeof dailyNoteSchema>;
export type UpsertNoteRequest = z.input<typeof upsertNoteRequestSchema>;
export type StudyProgress = z.infer<typeof studyProgressSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;
export type ListNotesResponse = z.infer<typeof listNotesResponseSchema>;
export type StudyProgressResponse = z.infer<typeof studyProgressResponseSchema>;
