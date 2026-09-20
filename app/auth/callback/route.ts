import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/account';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Where a magic link and an OAuth sign-in come back to.
 *
 * The code in the address is exchanged for a session here, on the server,
 * so the tokens land in HTTP-only cookies rather than in a URL fragment
 * that ends up in history and in referrers.
 *
 * `?next=` is passed through `safeNext`, which only ever yields a path on
 * this site. Without that this route would be an open redirect wearing
 * the site's own domain, which is the most convincing phishing link there
 * is.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/account?error=unavailable', url.origin));
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/account/sign-in?error=link', url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/account/sign-in?error=link', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
