import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export interface StoreFileInput {
  key: string;
  data: Buffer;
}

export interface StorageService {
  put(input: StoreFileInput): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Private local-disk storage for development. Keys are resolved below one
 * configured root and are not mounted by Express as static files.
 */
export class LocalStorageService implements StorageService {
  readonly rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = resolve(rootPath);
  }

  private pathFor(key: string): string {
    const target = resolve(this.rootPath, key);
    if (!target.startsWith(`${this.rootPath}${sep}`)) {
      throw new Error("Storage key escapes the configured root.");
    }

    return target;
  }

  async put(input: StoreFileInput): Promise<void> {
    const target = this.pathFor(input.key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.data, { flag: "wx", mode: 0o600 });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
