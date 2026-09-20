'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseAttempts, safeNext } from '@/lib/account';
import { SIGN_IN_LIMIT } from '@/lib/security/rate-limit';
import { callerAddress, spend } from '@/lib/services/rate-limit';
import {
  mergeBrowserAttempts,
  toggleFavourite,
  type Favourite,
} from '@/lib/services/account';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * The sign-in actions, written as form actions rather than as fetches.
 *
 * Next.js posts a plain form to a server action when scripting is off, so
 * the whole sign-in works without JavaScript, the same way the games do.
 * The outcome is carried back in the address rather than in component
 * state for exactly that reason: a reader with no scripting still sees
 * what happened.
 */
async function siteOrigin(): Promise<string> {
  const heads = await headers();
  const host = heads.get('x-forwarded-host') ?? heads.get('host') ?? 'localhost:3000';
  const protocol = heads.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}

export async function sendMagicLink(formData: FormData): Promise<void> {
  const next = safeNext(String(formData.get('next') ?? ''));
  const email = String(formData.get('email') ?? '').trim();

  if (!isSupabaseConfigured()) {
    redirect(`/account/sign-in?error=unavailable&next=${encodeURIComponent(next)}`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect(`/account/sign-in?error=email&next=${encodeURIComponent(next)}`);
  }

  // Counted against the address and against the caller, because either
  // alone is a hole: one caller must not be able to mail a thousand
  // addresses, and a thousand callers must not be able to mail one.
  const attempts = await Promise.all([
    spend('sign-in-email', email, SIGN_IN_LIMIT),
    spend('sign-in-caller', await callerAddress(), SIGN_IN_LIMIT),
  ]);
  if (attempts.some((attempt) => !attempt.allowed)) {
    redirect(`/account/sign-in?error=slow-down&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  redirect(
    error
      ? `/account/sign-in?error=send&next=${encodeURIComponent(next)}`
      : `/account/sign-in?sent=1&next=${encodeURIComponent(next)}`,
  );
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(String(formData.get('next') ?? ''));

  if (!isSupabaseConfigured()) {
    redirect(`/account/sign-in?error=unavailable&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    redirect(`/account/sign-in?error=google&next=${encodeURIComponent(next)}`);
  }
  redirect(data.url);
}

/** Add or remove a favourite, then come back to the page that asked. */
export async function toggleFavouriteAction(formData: FormData): Promise<void> {
  const entityType = String(formData.get('entityType') ?? '') as Favourite['entityType'];
  const entityId = String(formData.get('entityId') ?? '');
  const back = safeNext(String(formData.get('next') ?? ''));

  const result =
    entityId.length > 0 ? await toggleFavourite(entityType, entityId) : 'unavailable';

  // Signed out, the honest thing is to offer the sign-in and come back
  // here afterwards, rather than to drop the click on the floor.
  if (result === 'unavailable') {
    redirect(`/account/sign-in?next=${encodeURIComponent(back)}`);
  }
  redirect(back);
}

/** Fold this browser's rounds into the account's, then show the result. */
export async function syncProgressAction(formData: FormData): Promise<void> {
  const attempts = parseAttempts(String(formData.get('attempts') ?? ''));
  const { added } = await mergeBrowserAttempts(attempts);
  redirect(`/account?added=${added}`);
}
