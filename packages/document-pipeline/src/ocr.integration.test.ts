import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { TesseractImageOcrService } from "./extractor.js";

const LETTERS: Record<string, string[]> = {
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function textPng(text: string): Buffer {
  const scale = 12;
  const margin = 24;
  const glyphWidth = 5;
  const gap = 2;
  const width = margin * 2 + (text.length * glyphWidth + (text.length - 1) * gap) * scale;
  const height = margin * 2 + 7 * scale;
  const pixels = Buffer.alloc((width + 1) * height, 255);

  for (let y = 0; y < height; y += 1) pixels[y * (width + 1)] = 0;
  for (const [letterIndex, letter] of [...text].entries()) {
    const glyph = LETTERS[letter];
    if (!glyph) continue;
    for (const [row, bits] of glyph.entries()) {
      for (const [column, bit] of [...bits].entries()) {
        if (bit !== "1") continue;
        const startX = margin + (letterIndex * (glyphWidth + gap) + column) * scale;
        const startY = margin + row * scale;
        for (let offsetY = 0; offsetY < scale; offsetY += 1) {
          for (let offsetX = 0; offsetX < scale; offsetX += 1) {
            pixels[(startY + offsetY) * (width + 1) + 1 + startX + offsetX] = 0;
          }
        }
      }
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 0;
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("local image OCR", () => {
  it("recognizes an English word with bundled language data", async () => {
    const text = await new TesseractImageOcrService().recognize(textPng("TELL"));
    expect(text.toUpperCase()).toContain("TELL");
  }, 20_000);
});
