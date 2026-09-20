import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Signing out.
 *
 * A POST, not a link: a GET would let any page on the internet sign a
 * reader out by embedding an image, and a prefetch would do it by
 * accident. The form that posts here needs no JavaScript.
 *
 * The session cookies are cleared here; the browser's own copies of
 * personal data — the attempt log and the service worker's caches — are
 * cleared on the page this redirects to, because only the browser can do
 * that. The exit gate names both.
 */
export async function POST(request: NextRequest) {
  const origin = new URL(request.url).origin;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  return NextResponse.redirect(new URL('/account/signed-out', origin), {
    // A POST that redirects must say 303, or the browser re-posts to the
    // destination.
    status: 303,
  });
}
