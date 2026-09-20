import { describe, expect, it } from 'vitest';
import { buildCsp, originOf } from '../csp';

const policy = (over: Partial<Parameters<typeof buildCsp>[0]> = {}) =>
  buildCsp({
    development: false,
    supabaseOrigin: 'https://project.supabase.co',
    ...over,
  });

/**
 * A policy is a security control, so these read as "what would this
 * stop" rather than as string comparisons.
 */
describe('the content security policy', () => {
  it('refuses to be framed, to frame, and to post anywhere else', () => {
    const value = policy();
    expect(value).toContain("frame-ancestors 'none'");
    expect(value).toContain("frame-src 'none'");
    expect(value).toContain("object-src 'none'");
    expect(value).toContain("form-action 'self'");
    expect(value).toContain("base-uri 'self'");
    expect(value).toContain("default-src 'self'");
  });

  it('opens a connection only to itself and to Supabase', () => {
    expect(policy()).toContain(
      "connect-src 'self' https://project.supabase.co wss://project.supabase.co",
    );
    expect(policy({ supabaseOrigin: null })).toContain("connect-src 'self';");
  });

  it('allows eval only while developing', () => {
    expect(policy({ development: true })).toContain("'unsafe-eval'");
    expect(policy()).not.toContain("'unsafe-eval'");
  });

  it('upgrades to https everywhere but a development machine', () => {
    expect(policy()).toContain('upgrade-insecure-requests');
    expect(policy({ development: true })).not.toContain('upgrade-insecure-requests');
  });

  it('loads a script only from this origin', () => {
    // Inline is allowed, for the reason in the module comment, but a
    // script from another host is not, and neither is a plugin.
    expect(policy()).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy()).not.toContain('https://cdn');
  });
});

describe('reading an origin out of a configured URL', () => {
  it('takes the origin and drops the rest', () => {
    expect(originOf('https://project.supabase.co/rest/v1')).toBe(
      'https://project.supabase.co',
    );
  });

  it('answers nothing for nothing, and for nonsense', () => {
    expect(originOf(undefined)).toBeNull();
    expect(originOf('')).toBeNull();
    expect(originOf('not a url')).toBeNull();
  });
});
