import { describe, expect, it } from "vitest";

import { dateKeySchema, listNotesQuerySchema, upsertNoteRequestSchema } from "./notes.js";

describe("note contracts", () => {
  it("accepts only real calendar days", () => {
    expect(dateKeySchema.safeParse("2026-10-12").success).toBe(true);
    expect(dateKeySchema.safeParse("2026-02-30").success).toBe(false);
    expect(dateKeySchema.safeParse("2026-10-12T00:00").success).toBe(false);
  });

  it("trims content, defaults links and rejects duplicate tags", () => {
    const parsed = upsertNoteRequestSchema.parse({
      content: "  New word: resilient  ",
      understanding: 2,
      tags: ["Vocabulary"],
    });
    expect(parsed).toMatchObject({
      content: "New word: resilient",
      documentIds: [],
      attemptIds: [],
    });
    expect(
      upsertNoteRequestSchema.safeParse({
        content: "x",
        understanding: 2,
        tags: ["Grammar", "grammar"],
      }).success,
    ).toBe(false);
    expect(upsertNoteRequestSchema.safeParse({ content: "x", understanding: 4 }).success).toBe(
      false,
    );
    expect(upsertNoteRequestSchema.safeParse({ content: "   ", understanding: 1 }).success).toBe(
      false,
    );
  });

  it("bounds the calendar range", () => {
    expect(listNotesQuerySchema.safeParse({ from: "2026-10-01", to: "2026-10-31" }).success).toBe(
      true,
    );
    expect(listNotesQuerySchema.safeParse({ from: "2026-10-31", to: "2026-10-01" }).success).toBe(
      false,
    );
    expect(listNotesQuerySchema.safeParse({ from: "2026-01-01", to: "2026-12-31" }).success).toBe(
      false,
    );
  });
});
