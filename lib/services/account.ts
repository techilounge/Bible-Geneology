import 'server-only';
import { cache } from 'react';
import { attemptsToUpload, mergeAttempts } from '@/lib/account';
import type { Attempt } from '@/lib/progress';
import { QUIZ_MODES, type QuizMode } from '@/lib/quiz';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in reader's own rows.
 *
 * Every read and write here goes through the anonymous key as the user,
 * so the database refuses anything that is not theirs. Nothing in this
 * module checks ownership itself: a check in application code is an
 * opinion, and requirement section 55 wants the refusal to be the
 * database's. `tests/db/personal-data.test.ts` is where that is proved.
 *
 * Every function tolerates a deploy with no Supabase at all. Requirement
 * section 46 says exploration needs no account, and this environment has
 * no keys, so "not configured" is a normal state rather than an error.
 */
export interface AccountUser {
  id: string;
  email: string | null;
}

export interface AccountProfile {
  displayName: string | null;
  createdAt: string;
}

export interface Favourite {
  entityType: 'person' | 'event' | 'discovery' | 'comparison';
  entityId: string;
  createdAt: string;
}

export const accountsEnabled = (): boolean => isSupabaseConfigured();

/**
 * Who is signed in, or nobody.
 *
 * `getUser` rather than `getSession`: the session cookie is whatever the
 * browser sent, and only `getUser` asks the auth server whether the token
 * in it is genuine. Cached per request because the header, the page and
 * the account panel all ask.
 */
export const getCurrentUser = cache(async (): Promise<AccountUser | null> => {
  if (!accountsEnabled()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
});

export async function getProfile(): Promise<AccountProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('display_name, created_at')
    .eq('id', user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    displayName: (data.display_name as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}

export async function getFavourites(): Promise<Favourite[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('favorites')
    .select('entity_type, entity_id, created_at')
    .order('created_at', { ascending: false });
  return (data ?? []).map((row) => ({
    entityType: row.entity_type as Favourite['entityType'],
    entityId: row.entity_id as string,
    createdAt: row.created_at as string,
  }));
}

/**
 * Adds a favourite, or removes it if it is already there.
 *
 * No `user_id` is sent. The column defaults to `auth.uid()`, and the
 * insert policy would refuse any other value anyway, so the client never
 * gets to name an owner.
 */
export async function toggleFavourite(
  entityType: Favourite['entityType'],
  entityId: string,
): Promise<'added' | 'removed' | 'unavailable'> {
  const user = await getCurrentUser();
  if (!user) return 'unavailable';
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('favorites')
    .select('id')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();

  if (existing) {
    await supabase.from('favorites').delete().eq('id', existing.id);
    return 'removed';
  }

  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId });
  return error ? 'unavailable' : 'added';
}

const isMode = (value: unknown): value is QuizMode =>
  typeof value === 'string' && (QUIZ_MODES as readonly string[]).includes(value);

/** The account's attempt log, in the shape the progress rules read. */
export async function getAccountAttempts(): Promise<Attempt[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('quiz_attempts')
    .select('question_id, mode, correct, played_on')
    .order('played_on', { ascending: true });

  const attempts: Attempt[] = [];
  for (const row of data ?? []) {
    // A row written before the mode column existed cannot be tallied by
    // mode, and guessing one would put a badge on the wrong board.
    if (!isMode(row.mode)) continue;
    attempts.push({
      questionId: row.question_id as string,
      mode: row.mode,
      correct: row.correct as boolean,
      day: String(row.played_on).slice(0, 10),
    });
  }
  return attempts;
}

/**
 * Folds a browser's attempt log into the account's.
 *
 * The union is computed in `lib/account/merge.ts`, which is pure and
 * tested; this only writes the difference. Doing it the other way — an
 * upsert per attempt — would need a natural key in the table and would
 * still double-count a replay, so the arithmetic stays where it can be
 * proved.
 */
export async function mergeBrowserAttempts(
  browser: readonly Attempt[],
): Promise<{ merged: Attempt[]; added: number }> {
  const account = await getAccountAttempts();
  const user = await getCurrentUser();
  if (!user) return { merged: [...browser], added: 0 };

  const merged = mergeAttempts(account, browser);
  const fresh = attemptsToUpload(account, browser);
  if (fresh.length === 0) return { merged, added: 0 };

  const supabase = await createClient();
  const { error } = await supabase.from('quiz_attempts').insert(
    fresh.map((attempt) => ({
      user_id: user.id,
      question_id: attempt.questionId,
      mode: attempt.mode,
      correct: attempt.correct,
      played_on: attempt.day,
    })),
  );
  return { merged, added: error ? 0 : fresh.length };
}
