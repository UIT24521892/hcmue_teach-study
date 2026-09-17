import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Search, X } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "@mach/ui";

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Phân trang" className="mt-5 flex flex-wrap items-center justify-center gap-3">
      <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>
        Trang trước
      </Button>
      <span className="text-xs text-ink-muted tabular-nums" aria-live="polite">
        Trang {page + 1}/{pageCount}
      </span>
      <Button
        variant="secondary"
        disabled={page === pageCount - 1}
        onClick={() => onChange(page + 1)}
      >
        Trang sau
      </Button>
    </nav>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function LinkButton({
  to,
  children,
  secondary = false,
  className,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold",
        secondary
          ? "border border-line bg-surface hover:bg-surface-raised"
          : "bg-accent text-accent-ink hover:bg-accent-strong",
        className,
      )}
    >
      {children}
    </Link>
  );
}
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-ink underline-offset-4 hover:underline"
      to={to}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "accent" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        tone === "accent"
          ? "bg-accent/15 text-ink"
          : tone === "blue"
            ? "bg-focus/10 text-focus"
            : "bg-surface-raised text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="panel px-6 py-14 text-center">
      <Search className="mx-auto mb-4 size-8 text-ink-muted" aria-hidden="true" />
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mx-auto mb-6 mt-3 max-w-md text-sm leading-6 text-ink-muted">{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content className="dialog-panel">
          <Dialog.Title className="pr-10 font-display text-2xl font-semibold">{title}</Dialog.Title>
          <Dialog.Description className="mb-6 mt-2 text-sm leading-6 text-ink-muted">
            {description}
          </Dialog.Description>
          {children}
          <Dialog.Close className="icon-button absolute right-4 top-4" aria-label="Đóng hộp thoại">
            <X className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
