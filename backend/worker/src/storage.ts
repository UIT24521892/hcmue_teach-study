import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import type { DocumentStorageReader } from "@mach/document-pipeline";

export class LocalDocumentStorageReader implements DocumentStorageReader {
  private readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  async read(key: string): Promise<Buffer> {
    const target = resolve(this.rootPath, key);
    if (!target.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error("Storage key escapes the configured root.");
    }
    return readFile(target);
  }
}
