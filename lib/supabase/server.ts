import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from './env';

/**
 * The server client, acting as the signed-in user. Still constrained by RLS —
 * running on a server does not make a request privileged.
 */
export async function createClient() {
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a server component, where cookies are read-only.
            // Middleware refreshes the session instead.
          }
        },
      },
    },
  );
}
