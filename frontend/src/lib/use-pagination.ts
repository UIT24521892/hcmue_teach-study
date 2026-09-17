import { useState } from "react";

export function usePagination<T>(items: T[], pageSize = 6) {
  const [requestedPage, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requestedPage, pageCount - 1);
  return {
    page,
    pageCount,
    setPage,
    pageItems: items.slice(page * pageSize, (page + 1) * pageSize),
  };
}
