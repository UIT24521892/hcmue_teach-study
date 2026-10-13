import { createHash, randomUUID } from "node:crypto";

import type { Document } from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import { validateUploadedFile } from "./document.file.js";
import { toDocument } from "./document.mapper.js";
import { documentRepository, type DocumentRepository } from "./document.repository.js";
import type { StorageService } from "./document.storage.js";

export interface DocumentServiceDependencies {
  storage: StorageService;
  repository?: DocumentRepository;
}

export function createDocumentService(dependencies: DocumentServiceDependencies) {
  const repository = dependencies.repository ?? documentRepository;

  return {
    async upload(ownerId: string, file: Express.Multer.File): Promise<Document> {
      const validated = await validateUploadedFile(file);
      const id = randomUUID();
      const checksum = createHash("sha256").update(file.buffer).digest("hex");
      const storageKey = `${ownerId}/${id}.${validated.extension}`;

      await dependencies.storage.put({ key: storageKey, data: file.buffer });

      try {
        const created = await repository.create({
          id,
          ownerId,
          originalName: validated.originalName,
          storageKey,
          extension: validated.extension,
          mimeType: validated.mimeType,
          byteSize: file.buffer.length,
          checksum,
        });

        return toDocument(created);
      } catch (error) {
        try {
          await dependencies.storage.delete(storageKey);
        } catch {
          // Preserve the database error. A storage reconciliation job can clean
          // an orphan without exposing document contents or changing the API.
        }
        throw error;
      }
    },

    async getOwned(ownerId: string, documentId: string): Promise<Document> {
      const document = await repository.findOwnedById(documentId, ownerId);
      if (!document) {
        // A cross-owner lookup is intentionally indistinguishable from a
        // missing id, preventing document-id enumeration.
        throw HttpError.notFound("Không tìm thấy tài liệu.");
      }

      return toDocument(document);
    },

    async listOwned(ownerId: string, page: number, pageSize: number) {
      const result = await repository.listOwned(ownerId, {
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return {
        documents: result.items.map(toDocument),
        pagination: {
          page,
          pageSize,
          total: result.total,
          pageCount: result.total === 0 ? 0 : Math.ceil(result.total / pageSize),
        },
      };
    },

    async removeOwned(ownerId: string, documentId: string): Promise<void> {
      const document = await repository.findOwnedById(documentId, ownerId);
      if (!document) return;
      const deleted = await repository.deleteOwned(documentId, ownerId);
      if (deleted.count > 0) await dependencies.storage.delete(document.storageKey);
    },
  };
}
