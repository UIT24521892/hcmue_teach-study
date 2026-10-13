import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LocalDocumentStorageReader } from "./storage.js";

const created: string[] = [];

afterEach(async () => {
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("worker local storage reader", () => {
  it("reads a server-generated key below the configured root", async () => {
    const root = await mkdtemp(join(tmpdir(), "mach-worker-storage-"));
    created.push(root);
    await mkdir(join(root, "owner"));
    await writeFile(join(root, "owner", "document.txt"), "lesson");

    await expect(new LocalDocumentStorageReader(root).read("owner/document.txt")).resolves.toEqual(
      Buffer.from("lesson"),
    );
  });

  it("rejects traversal outside the private root", async () => {
    const root = await mkdtemp(join(tmpdir(), "mach-worker-storage-"));
    created.push(root);
    await expect(new LocalDocumentStorageReader(root).read("../secret.txt")).rejects.toThrow(
      "escapes",
    );
  });
});
