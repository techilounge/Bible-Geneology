import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  'aria-label': string;
  variant?: 'subtle' | 'outline' | 'ghost' | 'accent';
}

export function IconButton({
  icon,
  'aria-label': ariaLabel,
  variant = 'subtle',
  className,
  ...props
}: IconButtonProps) {
  const variantStyles = {
    subtle:
      'bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-subtle)]',
    outline:
      'border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
    ghost:
      'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
    accent:
      'bg-[var(--color-accent)] text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)]',
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        'active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <span className="shrink-0 [&>svg]:size-5">{icon}</span>
    </button>
  );
}
