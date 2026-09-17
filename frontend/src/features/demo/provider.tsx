import { useState, type ReactNode } from "react";
import { DemoContext } from "./context";
import { createDemoData } from "./fixtures";
import { demoSchema, type DemoData } from "./schema";

const key = "mach-demo-v1";
function readDemo() {
  try {
    const saved = localStorage.getItem(key);
    if (saved) return { data: demoSchema.parse(JSON.parse(saved)), error: "" };
  } catch {
    return {
      data: createDemoData(),
      error:
        "Không đọc được dữ liệu đã lưu. Đang hiển thị dữ liệu mẫu; thay đổi mới sẽ thử lưu lại trên trình duyệt.",
    };
  }
  return { data: createDemoData(), error: "" };
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readDemo);
  const [data, setData] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  function update(change: (data: DemoData) => DemoData) {
    const next = change(data);
    setData(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "Trình duyệt không cho phép lưu. Thay đổi chỉ giữ trong phiên hiện tại; đừng tải lại trang.",
      );
    }
  }
  return (
    <DemoContext.Provider value={{ data, update, storageError }}>{children}</DemoContext.Provider>
  );
}
