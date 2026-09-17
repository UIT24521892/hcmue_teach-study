import { z } from "zod";

export const roleSchema = z.enum(["teacher", "student", "self_learner"]);
export type Role = z.infer<typeof roleSchema>;
export const noteSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().max(5000),
  tags: z.string().max(200),
  understanding: z.number().min(1).max(3),
});
export type Note = z.infer<typeof noteSchema>;
export const documentSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(240),
  type: z.string(),
  status: z.enum(["ready", "review", "local"]),
  size: z.string(),
});
export type StudyDocument = z.infer<typeof documentSchema>;
export const classSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().max(200),
  members: z.number(),
  code: z.string(),
});
export type Classroom = z.infer<typeof classSchema>;
export const attemptSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  title: z.string(),
  date: z.string(),
  score: z.number(),
  answers: z.record(z.string()),
});
export type Attempt = z.infer<typeof attemptSchema>;
export const demoSchema = z.object({
  version: z.literal(1),
  role: roleSchema,
  name: z.string().min(1).max(80),
  goal: z.number().int().min(1).max(7),
  notes: z.array(noteSchema),
  documents: z.array(documentSchema),
  classes: z.array(classSchema),
  attempts: z.array(attemptSchema),
});
export type DemoData = z.infer<typeof demoSchema>;

export const roleLabels: Record<Role, string> = {
  teacher: "Giáo viên",
  student: "Học sinh",
  self_learner: "Người tự học",
};
