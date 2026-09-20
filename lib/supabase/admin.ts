import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * The service-role client. It bypasses RLS entirely, so it is the one thing in
 * this codebase that must never reach a browser.
 *
 * Three layers keep it there, because convention alone is not enough and the
 * consequence of getting it wrong is total database compromise:
 *
 *   1. The key has no NEXT_PUBLIC_ prefix, so Next.js will not inline it.
 *   2. The `server-only` import above turns a client-component import into a
 *      build error, and the throw below catches a runtime slip.
 *   3. CI greps the built client chunks for the key and for 'service_role'.
 *
 * Callers must check the caller's authorization themselves first. This client
 * grants everything; it decides nothing.
 *
 * See docs/SECURITY.md section 3.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('The service-role client must never be constructed in a browser');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for admin access',
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
