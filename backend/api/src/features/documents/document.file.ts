import { basename, extname } from "node:path";

import { fileTypeFromBuffer } from "file-type";

import { HttpError } from "../../lib/http-error.js";

export const allowedDocumentExtensions = [
  "pdf",
  "docx",
  "txt",
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

export type AllowedDocumentExtension = (typeof allowedDocumentExtensions)[number];

interface ValidatedFile {
  originalName: string;
  extension: AllowedDocumentExtension;
  mimeType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "text/plain"
    | "image/jpeg"
    | "image/png"
    | "image/webp";
}

const MIME_BY_EXTENSION: Record<AllowedDocumentExtension, ValidatedFile["mimeType"]> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const allowedExtensionSet = new Set<string>(allowedDocumentExtensions);

export function validateOriginalFilename(rawName: string): {
  originalName: string;
  extension: AllowedDocumentExtension;
} {
  const originalName = rawName.normalize("NFC").trim();
  const hasUnsafePath = originalName !== basename(originalName) || originalName.includes("\\");
  const hasControlCharacter = [...originalName].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });

  if (
    originalName.length === 0 ||
    originalName.length > 180 ||
    hasUnsafePath ||
    hasControlCharacter
  ) {
    throw HttpError.badRequest("Tên file không hợp lệ.");
  }

  const extension = extname(originalName).slice(1).toLowerCase();
  if (!allowedExtensionSet.has(extension)) {
    throw HttpError.unsupportedMedia(
      `Chỉ hỗ trợ file ${allowedDocumentExtensions.join(", ").toUpperCase()}.`,
    );
  }

  return { originalName, extension: extension as AllowedDocumentExtension };
}

function isValidUtf8Text(buffer: Buffer): boolean {
  if (buffer.includes(0)) {
    return false;
  }

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

export async function validateUploadedFile(file: Express.Multer.File): Promise<ValidatedFile> {
  if (file.buffer.length === 0) {
    throw HttpError.badRequest("File tải lên đang trống.");
  }

  const { originalName, extension } = validateOriginalFilename(file.originalname);
  const expectedMime = MIME_BY_EXTENSION[extension];

  if (file.mimetype.toLowerCase() !== expectedMime) {
    throw HttpError.unsupportedMedia("MIME khai báo không khớp với phần mở rộng của file.");
  }

  if (extension === "txt") {
    if (!isValidUtf8Text(file.buffer)) {
      throw HttpError.unsupportedMedia("File TXT phải là văn bản UTF-8 hợp lệ.");
    }
  } else {
    const detected = await fileTypeFromBuffer(file.buffer);
    const validJpegExtension =
      expectedMime === "image/jpeg" && detected?.mime === "image/jpeg" && detected.ext === "jpg";
    const exactMatch = detected?.mime === expectedMime && detected.ext === extension;

    if (!exactMatch && !validJpegExtension) {
      throw HttpError.unsupportedMedia("Nội dung file không khớp với loại file đã chọn.");
    }
  }

  return { originalName, extension, mimeType: expectedMime };
}
