import { createRequire } from "node:module";

import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker, OEM } from "tesseract.js";

import { DocumentPipelineError } from "./errors.js";
import type { ExtractedDocument, SourceDocument, SupportedDocumentExtension } from "./types.js";

const require = createRequire(import.meta.url);
const englishData = require("@tesseract.js-data/eng") as {
  code: "eng";
  gzip: boolean;
  langPath: string;
};

export interface ImageOcrService {
  recognize(image: Buffer): Promise<string>;
}

export class TesseractImageOcrService implements ImageOcrService {
  async recognize(image: Buffer): Promise<string> {
    const worker = await createWorker("eng", OEM.DEFAULT, {
      langPath: englishData.langPath,
      gzip: englishData.gzip,
    });
    try {
      const result = await worker.recognize(image);
      return result.data.text;
    } finally {
      await worker.terminate();
    }
  }
}

export interface DocumentExtractorOptions {
  maxCharacters: number;
  imageOcr?: ImageOcrService;
}

function normalizeExtractedText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function enforceContentLimit(text: string, maxCharacters: number): string {
  const normalized = normalizeExtractedText(text);
  if (!normalized) {
    throw new DocumentPipelineError(
      "CONTENT_EMPTY",
      "Không tìm thấy văn bản có thể đọc trong tài liệu.",
    );
  }
  if (normalized.length > maxCharacters) {
    throw new DocumentPipelineError(
      "CONTENT_TOO_LONG",
      `Nội dung tài liệu vượt quá giới hạn ${maxCharacters.toLocaleString("vi-VN")} ký tự.`,
    );
  }
  return normalized;
}

async function extractPdf(
  buffer: Buffer,
  maxCharacters: number,
): Promise<{ text: string; pageCount: number }> {
  const task = getDocument({
    data: new Uint8Array(buffer),
    stopAtErrors: true,
    useWorkerFetch: false,
  });
  const pdf = await task.promise;
  try {
    const pages: string[] = [];
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pages.push(text);
      characterCount += text.length;
      if (characterCount > maxCharacters) {
        throw new DocumentPipelineError(
          "CONTENT_TOO_LONG",
          `Nội dung tài liệu vượt quá giới hạn ${maxCharacters.toLocaleString("vi-VN")} ký tự.`,
        );
      }
    }
    return { text: pages.join("\n\n"), pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

const IMAGE_EXTENSIONS = new Set<SupportedDocumentExtension>(["jpg", "jpeg", "png", "webp"]);

export function createDocumentExtractor(options: DocumentExtractorOptions) {
  const imageOcr = options.imageOcr ?? new TesseractImageOcrService();

  return {
    async extract(document: SourceDocument, buffer: Buffer): Promise<ExtractedDocument> {
      try {
        let text: string;
        let pageCount: number | null = null;

        if (document.extension === "txt") {
          text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        } else if (document.extension === "docx") {
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
        } else if (document.extension === "pdf") {
          const result = await extractPdf(buffer, options.maxCharacters);
          text = result.text;
          pageCount = result.pageCount;
        } else if (IMAGE_EXTENSIONS.has(document.extension)) {
          text = await imageOcr.recognize(buffer);
          pageCount = 1;
        } else {
          throw new DocumentPipelineError(
            "EXTRACTION_FAILED",
            "Loại tài liệu này chưa có bộ trích xuất.",
          );
        }

        const normalized = enforceContentLimit(text, options.maxCharacters);
        return { text: normalized, characterCount: normalized.length, pageCount };
      } catch (error) {
        if (error instanceof DocumentPipelineError) throw error;
        throw new DocumentPipelineError(
          "EXTRACTION_FAILED",
          "Không thể trích xuất nội dung tài liệu. File có thể bị hỏng hoặc được bảo vệ.",
          { retryable: false, cause: error },
        );
      }
    },
  };
}

export type DocumentExtractor = ReturnType<typeof createDocumentExtractor>;
