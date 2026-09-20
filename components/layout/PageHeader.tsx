import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {eyebrow ? (
        <p className="text-xs tracking-widest text-[var(--color-accent)] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="text-3xl font-semibold text-balance sm:text-4xl">{title}</h1>
      {lede ? (
        <p className="max-w-2xl text-[var(--color-text-secondary)]">{lede}</p>
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
