import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-7 w-7', className)}
    >
      <path
        d="M6.5 26.5V6.5h8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.5 16h6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="21" cy="19.5" r="5.5" stroke="currentColor" strokeWidth="2.4" />
      <path
        d="M17.2 15.4C18.6 10.4 21.6 7.6 26.4 7.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark className="h-7 w-7 text-electric" />
      <span className="font-display text-lg font-bold tracking-tight">
        Faded<span className="text-electric">6</span>
      </span>
    </span>
  );
}
