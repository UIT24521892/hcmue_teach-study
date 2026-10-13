import { Prisma } from "@prisma/client";

import { HttpError } from "../../lib/http-error.js";
import { prisma } from "../../lib/prisma.js";

const STALE_MESSAGE = "Ghi chú đã thay đổi ở một phiên khác. Hãy tải lại trang.";

export const noteInclude = {
  tags: { include: { tag: { select: { name: true } } } },
  links: {
    orderBy: { createdAt: "asc" },
    include: {
      document: { select: { id: true, originalName: true, ownerId: true, deletedAt: true } },
      attempt: {
        select: { id: true, userId: true, score: true, quiz: { select: { title: true } } },
      },
    },
  },
} satisfies Prisma.DailyNoteInclude;

export type NoteRecord = Prisma.DailyNoteGetPayload<{ include: typeof noteInclude }>;

export interface NoteWrite {
  content: string;
  understanding: number;
  tags: Array<{ name: string; normalized: string }>;
  documentIds: string[];
  attemptIds: string[];
}

type Transaction = Prisma.TransactionClient;

async function replaceRelations(
  transaction: Transaction,
  userId: string,
  noteId: string,
  input: NoteWrite,
): Promise<void> {
  const tagIds: string[] = [];
  for (const tag of input.tags) {
    const saved = await transaction.tag.upsert({
      where: { userId_normalized: { userId, normalized: tag.normalized } },
      create: { userId, name: tag.name, normalized: tag.normalized },
      update: {},
      select: { id: true },
    });
    tagIds.push(saved.id);
  }
  await transaction.dailyNoteTag.deleteMany({ where: { noteId } });
  if (tagIds.length > 0) {
    await transaction.dailyNoteTag.createMany({
      data: tagIds.map((tagId) => ({ noteId, tagId })),
    });
  }
  await transaction.dailyNoteLink.deleteMany({ where: { noteId } });
  await transaction.dailyNoteLink.createMany({
    data: [
      ...input.documentIds.map((documentId) => ({ noteId, documentId })),
      ...input.attemptIds.map((attemptId) => ({ noteId, attemptId })),
    ],
  });
}

export const noteRepository = {
  async userTimeZone(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return user?.timezone ?? null;
  },

  listInRange(userId: string, from: Date, to: Date): Promise<NoteRecord[]> {
    return prisma.dailyNote.findMany({
      where: { userId, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      include: noteInclude,
    });
  },

  async countOwnedDocuments(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return prisma.document.count({ where: { id: { in: ids }, ownerId: userId, deletedAt: null } });
  },

  async countOwnedSubmittedAttempts(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return prisma.quizAttempt.count({ where: { id: { in: ids }, userId, status: "SUBMITTED" } });
  },

  /**
   * Creates the day's note or updates it with a version check. Returns the
   * saved note and whether it was newly created.
   */
  async upsert(input: {
    id: string;
    userId: string;
    date: Date;
    version: number | undefined;
    write: NoteWrite;
  }): Promise<{ note: NoteRecord; created: boolean }> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const existing = await transaction.dailyNote.findUnique({
          where: { userId_date: { userId: input.userId, date: input.date } },
          select: { id: true, version: true },
        });
        let noteId: string;
        if (existing) {
          if (input.version !== existing.version) {
            throw HttpError.conflict(STALE_MESSAGE, { currentVersion: existing.version });
          }
          const changed = await transaction.dailyNote.updateMany({
            where: { id: existing.id, version: existing.version },
            data: {
              content: input.write.content,
              understanding: input.write.understanding,
              version: { increment: 1 },
            },
          });
          if (changed.count === 0) throw HttpError.conflict(STALE_MESSAGE);
          noteId = existing.id;
        } else {
          if (input.version !== undefined) {
            // The client edited a note that no longer exists (deleted elsewhere).
            throw HttpError.conflict(STALE_MESSAGE, { currentVersion: null });
          }
          await transaction.dailyNote.create({
            data: {
              id: input.id,
              userId: input.userId,
              date: input.date,
              content: input.write.content,
              understanding: input.write.understanding,
            },
          });
          noteId = input.id;
        }
        await replaceRelations(transaction, input.userId, noteId, input.write);
        const note = await transaction.dailyNote.findUniqueOrThrow({
          where: { id: noteId },
          include: noteInclude,
        });
        return { note, created: !existing };
      });
    } catch (error) {
      // Two first saves of the same day raced; the loser must reload.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw HttpError.conflict(STALE_MESSAGE);
      }
      throw error;
    }
  },

  async delete(userId: string, date: Date, version: number): Promise<void> {
    const removed = await prisma.dailyNote.deleteMany({ where: { userId, date, version } });
    if (removed.count > 0) return;
    const exists = await prisma.dailyNote.findUnique({
      where: { userId_date: { userId, date } },
      select: { version: true },
    });
    if (!exists) throw HttpError.notFound("Không tìm thấy ghi chú.");
    throw HttpError.conflict(STALE_MESSAGE, { currentVersion: exists.version });
  },

  async noteDays(userId: string): Promise<Date[]> {
    const rows = await prisma.dailyNote.findMany({ where: { userId }, select: { date: true } });
    return rows.map((row) => row.date);
  },

  /** Submission days converted to the user's timezone inside PostgreSQL. */
  async attemptDays(userId: string, timeZone: string): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ day: string }>>`
      SELECT DISTINCT to_char(("submitted_at" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}, 'YYYY-MM-DD') AS day
      FROM "quiz_attempts"
      WHERE "user_id" = ${userId} AND "status" = 'SUBMITTED' AND "submitted_at" IS NOT NULL
    `;
    return rows.map((row) => row.day);
  },
};

export type NoteRepository = typeof noteRepository;
