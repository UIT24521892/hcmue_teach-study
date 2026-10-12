import { describe, expect, it } from "vitest";

import { HttpError } from "../../lib/http-error.js";
import { validateOriginalFilename } from "./document.file.js";

describe("validateOriginalFilename", () => {
  it("normalizes a safe supported filename", () => {
    expect(validateOriginalFilename("  Bài học.PDF  ")).toEqual({
      originalName: "Bài học.PDF",
      extension: "pdf",
    });
  });

  it.each(["../lesson.pdf", "folder/lesson.pdf", "folder\\lesson.pdf", "bad\u0000.pdf"])(
    "rejects path or control characters in %s",
    (filename) => {
      expect(() => validateOriginalFilename(filename)).toThrow(HttpError);
    },
  );

  it("rejects executable and HTML extensions", () => {
    expect(() => validateOriginalFilename("lesson.html")).toThrow(HttpError);
    expect(() => validateOriginalFilename("lesson.exe")).toThrow(HttpError);
  });
});
