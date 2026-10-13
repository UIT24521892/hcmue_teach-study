/** A small open book with a sprout, for the featured lesson. */
export function LessonIllustration() {
  return (
    <svg viewBox="0 0 120 100" aria-hidden="true" className="h-auto w-full">
      <circle cx="60" cy="50" r="46" className="fill-accent/10" />
      <path d="M60 74C46 64 30 62 16 64V30c14-2 30 0 44 10Z" className="fill-surface stroke-tree" />
      <path
        d="M60 74c14-10 30-12 44-10V30c-14-2-30 0-44 10Z"
        className="fill-surface stroke-tree"
      />
      <path
        d="M24 40c9-1 18 1 28 6M24 48c9-1 18 1 28 6M68 46c10-5 19-7 28-6M68 54c10-5 19-7 28-6"
        className="fill-none stroke-ink/25"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M60 40V20" className="stroke-tree" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M60 26C48 24 46 14 52 12c8 2 10 8 8 14Z" className="fill-accent" />
      <path d="M60 22c10-4 16-1 15 5-7 3-12 1-15-5Z" className="fill-warning" />
    </svg>
  );
}
