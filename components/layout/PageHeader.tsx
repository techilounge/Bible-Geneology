import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
  icon,
}: {
  eyebrow?: string | undefined;
  title: string;
  lede?: string | undefined;
  children?: ReactNode | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--color-border-subtle)] pb-6 sm:pb-8">
      {eyebrow ? (
        <div className="flex items-center gap-2">
          {icon ? (
            <span className="flex size-6 items-center justify-center rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)] [&>svg]:size-3.5">
              {icon}
            </span>
          ) : null}
          <p className="text-xs font-semibold tracking-widest text-[var(--color-accent)] uppercase">
            {eyebrow}
          </p>
        </div>
      ) : null}
      <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl lg:text-5xl text-[var(--color-text-primary)]">
        {title}
      </h1>
      {lede ? (
        <p className="max-w-3xl text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed">
          {lede}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** Every page's content sits in this, so the gutter is defined once. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-12">
      {children}
    </div>
  );
}
