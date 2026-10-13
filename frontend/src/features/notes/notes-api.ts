import {
  listNotesResponseSchema,
  noteResponseSchema,
  studyProgressResponseSchema,
  type UpsertNoteRequest,
} from "@mach/contracts";
import { z } from "zod";

import type { ApiClient } from "../auth/api-client";

export function createNotesApi(client: ApiClient) {
  return {
    list(from: string, to: string) {
      return client.request(`/notes?from=${from}&to=${to}`, { schema: listNotesResponseSchema });
    },
    progress() {
      return client.request("/notes/progress", { schema: studyProgressResponseSchema });
    },
    save(date: string, input: UpsertNoteRequest) {
      return client.request(`/notes/${date}`, {
        method: "PUT",
        body: input,
        schema: noteResponseSchema,
      });
    },
    remove(date: string, version: number) {
      return client.request(`/notes/${date}?version=${version}`, {
        method: "DELETE",
        schema: z.unknown(),
      });
    },
  };
}
