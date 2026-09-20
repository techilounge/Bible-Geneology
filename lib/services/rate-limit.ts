import 'server-only';
import { headers } from 'next/headers';
import {
  consume,
  limitKey,
  type Bucket,
  type Decision,
  type Limit,
} from '@/lib/security/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Where the token buckets are kept.
 *
 * Postgres when there is a service-role key, because a limit counted in
 * one process is no limit at all across two. A per-process map when
 * there is not, which is honest about being a speed bump rather than a
 * control — recorded as such in docs/PRODUCTION_READINESS.md.
 *
 * It fails open. A limiter whose own store is down must not be the
 * reason nobody can sign in, and the thing being limited here is
 * already limited again by the email provider.
 */
const local = new Map<string, Bucket>();

const hasStore = (): boolean => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

async function read(bucket: string): Promise<Bucket | null> {
  if (!hasStore()) return local.get(bucket) ?? null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('rate_limits')
      .select('tokens, updated_at')
      .eq('bucket', bucket)
      .maybeSingle();
    if (!data) return null;
    return {
      tokens: Number(data.tokens),
      updatedAt: new Date(String(data.updated_at)).getTime(),
    };
  } catch {
    return null;
  }
}

async function write(bucket: string, next: Bucket): Promise<void> {
  if (!hasStore()) {
    local.set(bucket, next);
    return;
  }
  try {
    const admin = createAdminClient();
    await admin.from('rate_limits').upsert({
      bucket,
      tokens: next.tokens,
      updated_at: new Date(next.updatedAt).toISOString(),
    });
  } catch {
    // Fail open, deliberately. See the note above.
  }
}

/** Spends one token against a key, and says whether it was there. */
export async function spend(
  action: string,
  value: string,
  limit: Limit,
): Promise<Decision> {
  const key = limitKey(action, value);
  const decision = consume(await read(key), limit, Date.now());
  await write(key, decision.bucket);
  return decision;
}

/**
 * The caller, as well as a proxy can say.
 *
 * `x-forwarded-for` is set by whatever is in front of the app and can
 * be forged by anyone talking to the app directly, so this is a way to
 * separate ordinary readers, not a way to identify an attacker. The
 * address limit is the one that stops the abuse that matters.
 */
export async function callerAddress(): Promise<string> {
  const heads = await headers();
  const forwarded = heads.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first && first.length > 0 ? first : 'unknown';
}
