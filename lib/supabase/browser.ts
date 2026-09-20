import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from './env';

/**
 * The browser client. Constrained entirely by RLS: the anon key is public by
 * design, so it is safe only because the policies are correct.
 */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
