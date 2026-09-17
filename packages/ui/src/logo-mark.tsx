export interface LogoMarkProps {
  className?: string;
  title?: string;
}

export function LogoMark({ className = "", title = "Mạch" }: LogoMarkProps) {
  return (
    <svg
      aria-label={title}
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="currentColor" height="40" rx="13" width="40" />
      <path
        d="M9 23.25c3.1 0 3.1-6.5 6.2-6.5s3.1 9.5 6.2 9.5 3.1-13 6.2-13 3.1 7 3.1 7"
        stroke="var(--color-logo-line, #fffaf0)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}
