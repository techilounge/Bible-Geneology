import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'accent' | 'subtle' | 'outline' | 'success' | 'gold';
  size?: 'sm' | 'md';
  icon?: ReactNode;
}

export function Badge({
  className,
  children,
  variant = 'subtle',
  size = 'md',
  icon,
  ...props
}: BadgeProps) {
  const variantStyles = {
    accent:
      'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/30',
    gold: 'bg-amber-400/10 text-amber-300 border border-amber-400/25',
    subtle:
      'bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]',
    outline:
      'border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] bg-transparent',
    success: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/25',
  };

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs sm:text-sm px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tracking-wide',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-3.5">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}
