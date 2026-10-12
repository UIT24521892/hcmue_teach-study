import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { createDocumentExtractor } from "./extractor.js";
import { MockQuestionGenerationProvider } from "./question-provider.js";
import { createDocumentProcessor } from "./processor.js";
import type {
  DocumentPipelineJob,
  DocumentPipelineRepository,
  ExtractedDocument,
  GeneratedQuestion,
  SourceDocument,
} from "./types.js";

function createPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  return Buffer.from(
    `${body}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`,
    "ascii",
  );
}

async function createDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("document processor", () => {
  it("takes PDF, DOCX, TXT and image through extraction and validated question generation once", async () => {
    const files = new Map<string, Buffer>([
      ["doc-pdf", createPdf("Daily practice builds progress.")],
      ["doc-txt", Buffer.from("Vocabulary review builds confidence.")],
      ["doc-image", Buffer.from("image-bytes")],
      ["doc-docx", await createDocx("Reading small passages builds fluency.")],
    ]);
    const documents: SourceDocument[] = [
      {
        id: "pdf",
        storageKey: "doc-pdf",
        originalName: "a.pdf",
        extension: "pdf",
        mimeType: "application/pdf",
      },
      {
        id: "docx",
        storageKey: "doc-docx",
        originalName: "a.docx",
        extension: "docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      {
        id: "txt",
        storageKey: "doc-txt",
        originalName: "a.txt",
        extension: "txt",
        mimeType: "text/plain",
      },
      {
        id: "image",
        storageKey: "doc-image",
        originalName: "a.png",
        extension: "png",
        mimeType: "image/png",
      },
    ];
    const jobs = new Map<string, DocumentPipelineJob>(
      documents.map((document) => [
        `job-${document.id}`,
        { id: `job-${document.id}`, document, attempt: 1, maxAttempts: 3 },
      ]),
    );
    const completions = new Map<
      string,
      { extracted: ExtractedDocument; questions: GeneratedQuestion[] }
    >();
    const claimed = new Set<string>();
    const repository: DocumentPipelineRepository = {
      claim: async (jobId) => {
        if (claimed.has(jobId)) return null;
        claimed.add(jobId);
        return jobs.get(jobId) ?? null;
      },
      setProgress: async () => undefined,
      complete: async (job, extracted, questions) => {
        completions.set(job.id, { extracted, questions });
      },
      fail: async () => undefined,
    };
    const processor = createDocumentProcessor({
      repository,
      storage: { read: async (key) => files.get(key) ?? Promise.reject(new Error("missing")) },
      extractor: createDocumentExtractor({
        maxCharacters: 2_000,
        imageOcr: { recognize: async () => "An image about consistent learning." },
      }),
      questionProvider: new MockQuestionGenerationProvider(),
      targetQuestionCount: 3,
    });

    for (const jobId of jobs.keys()) {
      await processor.process(jobId);
      await processor.process(jobId);
    }

    expect(completions.size).toBe(4);
    for (const result of completions.values()) {
      expect(result.extracted.characterCount).toBeGreaterThan(10);
      expect(result.questions.map((question) => question.type)).toEqual([
        "multiple_choice",
        "fill_blank",
        "true_false",
      ]);
    }
  });
});
