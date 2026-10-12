import { describe, expect, it } from "vitest";

import { parseWorkerConfig } from "./config.js";

describe("worker config", () => {
  it("uses local queue and extraction defaults", () => {
    const config = parseWorkerConfig({});
    expect(config.REDIS_URL).toBe("redis://localhost:6379");
    expect(config.DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS).toBe(100_000);
    expect(config.AI_PROVIDER).toBe("mock");
  });

  it("rejects unsupported storage and unsafe extraction limits", () => {
    expect(() => parseWorkerConfig({ STORAGE_PROVIDER: "public" })).toThrow("STORAGE_PROVIDER");
    expect(() => parseWorkerConfig({ DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS: "10" })).toThrow(
      "DOCUMENT_EXTRACTED_TEXT_MAX_CHARACTERS",
    );
  });
});
