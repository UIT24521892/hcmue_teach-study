import type { Document, Prisma } from "@prisma/client";

import { prisma } from "../../lib/prisma.js";

export const documentRepository = {
  create(data: Prisma.DocumentUncheckedCreateInput): Promise<Document> {
    return prisma.document.create({ data });
  },

  findOwnedById(documentId: string, ownerId: string): Promise<Document | null> {
    return prisma.document.findFirst({
      where: { id: documentId, ownerId, deletedAt: null },
    });
  },

  async listOwned(
    ownerId: string,
    input: { skip: number; take: number },
  ): Promise<{ items: Document[]; total: number }> {
    const where: Prisma.DocumentWhereInput = { ownerId, deletedAt: null };
    const [items, total] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: input.skip,
        take: input.take,
      }),
      prisma.document.count({ where }),
    ]);
    return { items, total };
  },

  deleteOwned(documentId: string, ownerId: string) {
    return prisma.document.deleteMany({ where: { id: documentId, ownerId } });
  },
};

export type DocumentRepository = typeof documentRepository;
