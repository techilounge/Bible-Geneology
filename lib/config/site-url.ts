/**
 * Where this deployment thinks it lives.
 *
 * `process.env.X ?? fallback` is the obvious way to write this and it
 * is wrong, because `??` only catches a variable that is absent. A
 * variable that is present and empty — which is what a hosting
 * dashboard gives you when somebody adds the key and saves before
 * typing the value — passes straight through, and then
 * `new URL('')` throws while the page data is being collected and the
 * whole production build fails. That is exactly how it failed.
 *
 * So the rule is: a value counts only if it parses as an absolute
 * http(s) URL. Anything else is treated as not set, and the site falls
 * back rather than failing to build. A wrong absolute URL in a share
 * card is a nuisance; a build that will not run is an outage.
 *
 * Pure, and takes its environment as an argument, so every one of
 * these cases is a test rather than a deployment.
 */
export const LOCAL_SITE_URL = 'http://localhost:3000';

export interface SiteUrlEnv {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  /** Vercel sets this for the production deployment, without a scheme. */
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  /** Vercel sets this per deployment, without a scheme. */
  NEXT_PUBLIC_VERCEL_URL?: string | undefined;
}

/** An absolute http(s) origin, with any trailing slash removed. */
function absolute(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** A bare host, as a hosting platform reports it, made into a URL. */
function fromHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return absolute(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
}

export function resolveSiteUrl(env: SiteUrlEnv): string {
  return (
    absolute(env.NEXT_PUBLIC_SITE_URL) ??
    fromHost(env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) ??
    fromHost(env.NEXT_PUBLIC_VERCEL_URL) ??
    LOCAL_SITE_URL
  );
}
