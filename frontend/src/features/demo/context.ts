import { createContext, useContext } from "react";
import type { DemoData } from "./schema";

export const DemoContext = createContext<{
  data: DemoData;
  update: (change: (data: DemoData) => DemoData) => void;
  storageError: string;
} | null>(null);
export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider is required");
  return context;
}
