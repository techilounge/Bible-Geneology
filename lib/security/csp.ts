/**
 * The Content-Security-Policy.
 *
 * The version of this that carried a per-request nonce with
 * `'strict-dynamic'` is the version that would have broken the site,
 * and finding that out is worth recording. Next.js only puts a nonce
 * on its script tags for a dynamically rendered response; this site
 * prerenders the person pages, the discoveries and most of the shell,
 * and a prerendered document cannot carry a nonce that changes per
 * request. The policy would then have blocked every script on the
 * pages that matter most, which is a broken site rather than a secure
 * one. The alternative — rendering everything per request — trades the
 * whole prerendered catalogue for it.
 *
 * So `script-src` allows `'self'` and inline, and that is a real
 * limitation, stated in docs/PRODUCTION_READINESS.md rather than
 * hidden. What still does work is doing the work: `form-action` stops
 * a posted form leaving the origin, `base-uri` stops a rewritten base
 * tag redirecting every relative URL, `frame-ancestors` stops
 * clickjacking, `connect-src` stops exfiltration to an attacker's
 * host, and `object-src` closes the plugin path. The compensating
 * control for the rest is that this site renders no user-supplied
 * HTML anywhere: every string goes through React's escaping, and
 * `dangerouslySetInnerHTML` appears nowhere in the codebase.
 *
 * Pure, so the policy can be asserted in a test rather than discovered
 * in a browser console.
 */
export interface CspOptions {
  /** Development needs eval for the dev-time module runtime. */
  development: boolean;
  /** The Supabase origin, when there is one to talk to. */
  supabaseOrigin: string | null;
}

export function buildCsp({ development, supabaseOrigin }: CspOptions): string {
  const connect = ["'self'"];
  if (supabaseOrigin) {
    connect.push(supabaseOrigin, supabaseOrigin.replace(/^https:/, 'wss:'));
  }

  const script = ["'self'", "'unsafe-inline'"];
  if (development) script.push("'unsafe-eval'");

  const directives: Array<[string, string[]]> = [
    ['default-src', ["'self'"]],
    ['script-src', script],
    ['style-src', ["'self'", "'unsafe-inline'"]],
    ['img-src', ["'self'", 'data:', 'blob:']],
    ['font-src', ["'self'"]],
    ['connect-src', connect],
    ['manifest-src', ["'self'"]],
    ['worker-src', ["'self'"]],
    // Nothing here is ever framed, and nothing here ever frames anything.
    ['frame-src', ["'none'"]],
    ['frame-ancestors', ["'none'"]],
    ['object-src', ["'none'"]],
    ['base-uri', ["'self'"]],
    // A form that posts elsewhere is either a bug or an exfiltration.
    ['form-action', ["'self'"]],
  ];

  const policy = directives
    .map(([name, values]) => `${name} ${values.join(' ')}`)
    .join('; ');

  // Meaningless over http, and http is only ever local.
  return development ? policy : `${policy}; upgrade-insecure-requests`;
}

/** The origin of a URL, or null when there is not a usable one. */
export function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}
