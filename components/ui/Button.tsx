import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-surface-base)] hover:bg-[var(--color-accent-strong)]',
  secondary:
    'bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]',
};

/**
 * Sizes meet the 44px minimum touch target of requirement section 50 at every
 * size, including `sm`, which reaches it through padding rather than by being
 * exempt. A control too small to hit on a phone is a control that does not
 * work, and "it is only a small button" is how that ships.
 */
const SIZES: Record<Size, string> = {
  sm: 'min-h-11 px-3 text-sm',
  md: 'min-h-11 px-4 text-base',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors disabled:pointer-events-none disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
