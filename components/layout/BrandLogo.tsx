import { branding } from '@/lib/config/branding';

export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-transparent p-0.5 ring-1 ring-amber-400/30 shadow-xs shadow-amber-500/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 text-[var(--color-accent)]"
          aria-hidden="true"
        >
          {/* Stylized tree & scroll axis */}
          <path d="M12 3v18" />
          <path d="M12 8a4 4 0 0 1 4-4h2" />
          <path d="M12 13a4 4 0 0 0-4-4H6" />
          <path d="M12 17a4 4 0 0 1 4-4h3" />
          <circle cx="18" cy="4" r="1.5" fill="currentColor" />
          <circle cx="6" cy="9" r="1.5" fill="currentColor" />
          <circle cx="19" cy="13" r="1.5" fill="currentColor" />
          <circle cx="12" cy="21" r="1.5" fill="currentColor" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
          {branding.shortName}
        </span>
      </div>
    </div>
  );
}
