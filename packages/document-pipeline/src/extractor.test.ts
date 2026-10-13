import { describe, expect, it } from "vitest";
import JSZip from "jszip";

import { createDocumentExtractor } from "./extractor.js";
import type { SourceDocument } from "./types.js";

function source(extension: SourceDocument["extension"]): SourceDocument {
  return {
    id: "document-1",
    storageKey: `owner/document.${extension}`,
    originalName: `document.${extension}`,
    extension,
    mimeType: extension === "txt" ? "text/plain" : "image/png",
  };
}

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
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "ascii");
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

describe("document extractor", () => {
  it("normalizes UTF-8 TXT content", async () => {
    const extractor = createDocumentExtractor({ maxCharacters: 100 });
    await expect(
      extractor.extract(source("txt"), Buffer.from("Hello   world\r\n\r\n\r\nToday")),
    ).resolves.toEqual({
      text: "Hello world\n\nToday",
      characterCount: 18,
      pageCount: null,
    });
  });

  it("uses the image OCR adapter without exposing image bytes", async () => {
    const extractor = createDocumentExtractor({
      maxCharacters: 100,
      imageOcr: { recognize: async () => "Read every day" },
    });
    await expect(extractor.extract(source("png"), Buffer.from("image"))).resolves.toEqual({
      text: "Read every day",
      characterCount: 14,
      pageCount: 1,
    });
  });

  it("extracts text from real PDF and DOCX containers", async () => {
    const extractor = createDocumentExtractor({ maxCharacters: 1_000 });
    const pdf = await extractor.extract(
      source("pdf"),
      createPdf("Daily practice builds progress."),
    );
    const docx = await extractor.extract(
      source("docx"),
      await createDocx("Small habits support resilient learners."),
    );

    expect(pdf).toMatchObject({ text: "Daily practice builds progress.", pageCount: 1 });
    expect(docx).toMatchObject({
      text: "Small habits support resilient learners.",
      pageCount: null,
    });
  });

  it("rejects empty and over-limit content with public-safe errors", async () => {
    const extractor = createDocumentExtractor({ maxCharacters: 5 });
    await expect(extractor.extract(source("txt"), Buffer.from("   "))).rejects.toMatchObject({
      code: "CONTENT_EMPTY",
    });
    await expect(extractor.extract(source("txt"), Buffer.from("too long"))).rejects.toMatchObject({
      code: "CONTENT_TOO_LONG",
    });
  });
});
