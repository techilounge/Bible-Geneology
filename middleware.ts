import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured, publicEnv } from '@/lib/supabase/env';

/**
 * Keeps a session alive across navigations.
 *
 * Supabase's access token is short-lived by design. Without a refresh on
 * the way through, a reader who leaves a tab open comes back signed out,
 * and — worse — a server component reads a stale cookie and renders a
 * signed-in page that the database then refuses to fill. The refresh has
 * to happen somewhere that can set cookies, and a server component
 * cannot.
 *
 * On a deploy with no Supabase configured this does nothing at all, which
 * is the state this repository's own browser suite runs in.
 */
export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.next();

  const response = NextResponse.next({ request });
  const env = publicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // The call is the point: it refreshes the token and writes the new
  // cookies onto the response. The user it returns is not used here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Everything except static assets. The exclusions are the files Next
   * serves straight from disk, where a round trip to the auth server
   * would be pure latency on every image.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest.webmanifest|sw.js|offline|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$).*)',
  ],
};
