import { branding } from '@/lib/config/branding';

/**
 * Phase 0 placeholder.
 *
 * The real home page is Phase 5 work (application shell) and the experiences it
 * links to are Phases 6 through 12. This page exists so that the Phase 0 exit
 * gate — "the project builds" — is a verifiable command rather than a claim.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-4">
      <p className="text-sm tracking-widest text-[var(--color-accent)] uppercase">
        Phase 0 · foundation
      </p>
      <h1 className="text-4xl font-semibold text-balance">{branding.tagline}</h1>
      <p className="text-[var(--color-text-secondary)]">{branding.description}</p>
      <p className="text-sm text-[var(--color-text-muted)]">
        {branding.productName} is being built in phases. The canonical dataset and the
        chronology engine come before any timeline is drawn. See the documents in{' '}
        <code>docs/</code> for the architecture and the build plan.
      </p>
    </main>
  );
}
