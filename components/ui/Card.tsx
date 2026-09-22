import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  glass?: boolean;
}

export function Card({
  className,
  children,
  interactive = false,
  glass = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] p-4',
        glass && 'glass-panel',
        interactive &&
          'transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-hover)] hover:shadow-lg hover:shadow-black/20',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h2 className={cn('text-lg font-semibold', className)} {...props}>
      {children}
    </h2>
  );
}
