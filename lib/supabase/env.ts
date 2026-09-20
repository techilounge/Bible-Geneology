import { z } from 'zod';

/**
 * Environment parsed once, at startup, so a misconfigured deploy fails
 * immediately rather than rendering broken pages.
 */
const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Whether accounts are available at all, without throwing.
 *
 * `publicEnv` throws, which is right for a deploy that means to have
 * accounts and has been configured wrong. It is wrong for a deploy that
 * has none: requirement section 46 says the core of the site needs no
 * account, so a build with no Supabase keys has to render every
 * exploration page and say plainly that signing in is unavailable,
 * rather than crash. This is the check the pages ask.
 */
export function isSupabaseConfigured(): boolean {
  return PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).success;
}

export function publicEnv() {
  const parsed = PublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Supabase public environment is not configured: ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    );
  }

  return parsed.data;
}
