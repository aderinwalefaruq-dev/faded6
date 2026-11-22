import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
}

export function StatTile({ label, value, hint, icon: Icon, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-card',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-electric" />}
      </div>
      <p className="font-display text-xl font-semibold leading-tight md:text-2xl">{value}</p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
