import type { DocumentJob } from "@mach/contracts";

import { HttpError } from "../../lib/http-error.js";
import { toDocument, toDocumentJob } from "./document.mapper.js";
import type { DocumentJobDispatcher } from "./document.dispatcher.js";
import {
  AiQuotaExceededError,
  documentJobRepository,
  isUniqueConstraintError,
  type DocumentJobRepository,
} from "./document-job.repository.js";

export interface DocumentJobServiceDependencies {
  dispatcher: DocumentJobDispatcher;
  maxAttempts: number;
  dailyQuota: number;
  repository?: DocumentJobRepository;
  now?: () => Date;
}

export function createDocumentJobService(dependencies: DocumentJobServiceDependencies) {
  const repository = dependencies.repository ?? documentJobRepository;
  const now = dependencies.now ?? (() => new Date());

  async function assertWithinQuota(ownerId: string): Promise<void> {
    const since = new Date(now().getTime() - 24 * 60 * 60 * 1_000);
    const used = await repository.countOwnerJobsSince(ownerId, since);
    if (used >= dependencies.dailyQuota) {
      throw HttpError.quotaExceeded("Bạn đã dùng hết lượt sinh câu hỏi trong 24 giờ qua.", {
        limit: dependencies.dailyQuota,
      });
    }
  }

  async function enqueue(ownerId: string, documentId: string): Promise<DocumentJob> {
    const document = await repository.findOwnedDocument(documentId, ownerId);
    if (!document) throw HttpError.notFound("Không tìm thấy tài liệu.");

    const active = await repository.findActive(documentId);
    if (active) return toDocumentJob(active);
    if (document.status === "READY") {
      throw HttpError.conflict("Tài liệu đã được xử lý thành công.");
    }

    await assertWithinQuota(ownerId);
    let created;
    try {
      const since = new Date(now().getTime() - 24 * 60 * 60 * 1_000);
      created = await repository.createQueued(
        documentId,
        ownerId,
        dependencies.maxAttempts,
        dependencies.dailyQuota,
        since,
      );
    } catch (error) {
      if (error instanceof AiQuotaExceededError) {
        throw HttpError.quotaExceeded("Bạn đã dùng hết lượt sinh câu hỏi trong 24 giờ qua.", {
          limit: dependencies.dailyQuota,
        });
      }
      if (!isUniqueConstraintError(error)) throw error;
      const winner = await repository.findActive(documentId);
      if (!winner) throw error;
      return toDocumentJob(winner);
    }

    try {
      await dependencies.dispatcher.dispatch(created.id);
    } catch {
      const message = "Hàng đợi xử lý tạm thời không khả dụng. Vui lòng thử lại.";
      await repository.markDispatchFailed(created.id, message);
      throw HttpError.serviceUnavailable(message);
    }
    return toDocumentJob(created);
  }

  return {
    assertWithinQuota,
    enqueue,
    async getOwnedDocumentWithJobs(ownerId: string, documentId: string) {
      const document = await repository.findOwnedDocument(documentId, ownerId);
      if (!document) throw HttpError.notFound("Không tìm thấy tài liệu.");
      const jobs = await repository.listOwned(documentId, ownerId);
      return { document: toDocument(document), jobs: jobs.map(toDocumentJob) };
    },
  };
}
