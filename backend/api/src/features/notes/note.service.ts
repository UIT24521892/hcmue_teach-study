import { randomUUID } from "node:crypto";

import {
  dailyNoteSchema,
  type DailyNote,
  type NoteLink,
  type StudyProgress,
  type upsertNoteRequestSchema,
} from "@mach/contracts";
import type { z } from "zod";

import { HttpError } from "../../lib/http-error.js";
import {
  calculateStreak,
  dateKeyToDbDate,
  dbDateToKey,
  localDateKey,
  resolveTimeZone,
} from "../../lib/local-date.js";
import { noteRepository, type NoteRecord, type NoteRepository } from "./note.repository.js";

type UpsertInput = z.output<typeof upsertNoteRequestSchema>;

export function normalizeTag(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

/** Links to sources the author can no longer see are hidden, not errors. */
function toNote(record: NoteRecord): DailyNote {
  const links: NoteLink[] = record.links.flatMap((link): NoteLink[] => {
    if (
      link.document &&
      link.document.deletedAt === null &&
      link.document.ownerId === record.userId
    )
      return [{ kind: "document", id: link.document.id, title: link.document.originalName }];
    if (link.attempt && link.attempt.userId === record.userId)
      return [
        {
          kind: "attempt",
          id: link.attempt.id,
          title: link.attempt.quiz.title,
          score: link.attempt.score,
        },
      ];
    return [];
  });
  return dailyNoteSchema.parse({
    id: record.id,
    date: dbDateToKey(record.date),
    content: record.content,
    understanding: record.understanding,
    tags: record.tags.map((entry) => entry.tag.name).sort((a, b) => a.localeCompare(b, "vi")),
    links,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export function createNoteService(
  repository: NoteRepository = noteRepository,
  clock: () => Date = () => new Date(),
) {
  async function todayFor(userId: string) {
    const timeZone = resolveTimeZone(await repository.userTimeZone(userId));
    return { timeZone, today: localDateKey(clock(), timeZone) };
  }

  return {
    async list(userId: string, from: string, to: string) {
      const records = await repository.listInRange(
        userId,
        dateKeyToDbDate(from),
        dateKeyToDbDate(to),
      );
      return records.map(toNote);
    },

    async upsert(userId: string, date: string, input: UpsertInput) {
      const { today } = await todayFor(userId);
      if (date > today) {
        throw HttpError.badRequest("Không thể ghi chú cho một ngày trong tương lai.", { today });
      }
      const [documents, attempts] = await Promise.all([
        repository.countOwnedDocuments(userId, input.documentIds),
        repository.countOwnedSubmittedAttempts(userId, input.attemptIds),
      ]);
      if (documents !== input.documentIds.length || attempts !== input.attemptIds.length) {
        // Foreign and missing ids look the same, so links cannot probe other users.
        throw HttpError.notFound("Không tìm thấy tài liệu hoặc bài làm để liên kết.");
      }
      const { note, created } = await repository.upsert({
        id: randomUUID(),
        userId,
        date: dateKeyToDbDate(date),
        version: input.version,
        write: {
          content: input.content,
          understanding: input.understanding,
          tags: input.tags.map((name) => ({
            name: name.normalize("NFC").trim().replace(/\s+/g, " "),
            normalized: normalizeTag(name),
          })),
          documentIds: input.documentIds,
          attemptIds: input.attemptIds,
        },
      });
      return { note: toNote(note), created };
    },

    async remove(userId: string, date: string, version: number) {
      await repository.delete(userId, dateKeyToDbDate(date), version);
    },

    /**
     * A study session is a local calendar day with a note or a submitted quiz
     * attempt; several activities on one day still count as one leaf.
     */
    async progress(userId: string): Promise<StudyProgress> {
      const { timeZone, today } = await todayFor(userId);
      const [noteDays, attemptDays] = await Promise.all([
        repository.noteDays(userId),
        repository.attemptDays(userId, timeZone),
      ]);
      const active = new Set([...noteDays.map(dbDateToKey), ...attemptDays]);
      return {
        timezone: timeZone,
        today,
        completedSessions: active.size,
        streakDays: calculateStreak(active, today),
      };
    },
  };
}
