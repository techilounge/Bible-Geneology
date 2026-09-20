import { describe, expect, it } from 'vitest';
import {
  REVIEW_STATUSES,
  STATUS_MEANING,
  allowedTransitions,
  canEdit,
  canReachAdmin,
  canVerify,
  isStaff,
  judgeChange,
  type AppRole,
  type ProposedChange,
  type ReviewStatus,
} from '../rules';

/**
 * These rules decide who may change the dataset, so every case here is
 * written as somebody trying to do something rather than as a call with
 * arguments.
 */
const change = (over: Partial<ProposedChange> = {}): ProposedChange => ({
  role: 'admin',
  from: 'DRAFT',
  to: 'DRAFT',
  changesFields: true,
  reason: 'Checked against Genesis 5:6',
  sources: ['kjv-1769'],
  ...over,
});

describe('who may reach the admin at all', () => {
  it('is editors and administrators, and nobody else', () => {
    const roles: AppRole[] = ['user', 'editor', 'admin'];
    expect(roles.filter(canReachAdmin)).toEqual(['editor', 'admin']);
    expect(roles.filter(isStaff)).toEqual(['editor', 'admin']);
    expect(roles.filter(canEdit)).toEqual(['editor', 'admin']);
    expect(roles.filter(canVerify)).toEqual(['admin']);
  });
});

describe('judging a proposed change', () => {
  it('refuses an ordinary reader outright', () => {
    expect(judgeChange(change({ role: 'user' }))).toEqual({
      ok: false,
      problem: 'Only an editor or an administrator may change a record.',
    });
  });

  it('lets an editor edit a draft without ceremony', () => {
    expect(judgeChange(change({ role: 'editor', reason: '', sources: [] }))).toEqual({
      ok: true,
    });
  });

  it('refuses an editor who tries to sign a record off', () => {
    const judged = judgeChange(change({ role: 'editor', to: 'VERIFIED' }));
    expect(judged).toEqual({
      ok: false,
      problem: 'Only an administrator may mark a record VERIFIED.',
    });
  });

  it('requires a reason to mark a record VERIFIED', () => {
    expect(judgeChange(change({ to: 'VERIFIED', reason: '   ' }))).toEqual({
      ok: false,
      problem: 'Marking a record VERIFIED needs a reason saying what was checked.',
    });
  });

  it('requires a source to mark a record VERIFIED', () => {
    for (const sources of [[], ['  ']]) {
      expect(judgeChange(change({ to: 'VERIFIED', sources })), String(sources)).toEqual({
        ok: false,
        problem:
          'Say what the change was checked against. A change to a verified record needs a source.',
      });
    }
  });

  it('accepts a verification that carries both', () => {
    expect(judgeChange(change({ to: 'VERIFIED' }))).toEqual({ ok: true });
  });

  it('requires a reason and a source to edit a verified record', () => {
    const editing = { from: 'VERIFIED', to: 'VERIFIED' } as const;
    expect(judgeChange(change({ ...editing, reason: '' }))).toEqual({
      ok: false,
      problem: 'Changing a VERIFIED record needs a reason saying why.',
    });
    expect(judgeChange(change({ ...editing, sources: [] })).ok).toBe(false);
    expect(judgeChange(change(editing))).toEqual({ ok: true });
  });

  it('asks nothing extra of a verified record nobody is changing', () => {
    expect(
      judgeChange(
        change({ from: 'VERIFIED', to: 'VERIFIED', changesFields: false, reason: '' }),
      ),
    ).toEqual({ ok: false, problem: 'Nothing has changed.' });
  });

  it('requires a reason to take a record back out of VERIFIED', () => {
    expect(judgeChange(change({ from: 'VERIFIED', to: 'DISPUTED', reason: '' }))).toEqual(
      {
        ok: false,
        problem: 'Changing a VERIFIED record needs a reason saying why.',
      },
    );
    expect(judgeChange(change({ from: 'VERIFIED', to: 'DISPUTED' }))).toEqual({
      ok: true,
    });
  });

  it('refuses a change that changes nothing', () => {
    expect(
      judgeChange(change({ from: 'DRAFT', to: 'DRAFT', changesFields: false })),
    ).toEqual({ ok: false, problem: 'Nothing has changed.' });
  });

  it('accepts a new record, which has no status to come from', () => {
    expect(judgeChange(change({ from: null, to: 'DRAFT' }))).toEqual({ ok: true });
    expect(judgeChange(change({ from: null, to: 'VERIFIED' }))).toEqual({ ok: true });
  });
});

describe('the transitions offered', () => {
  it('offers an ordinary reader nothing', () => {
    expect(allowedTransitions('user', 'DRAFT')).toEqual([]);
  });

  it('withholds VERIFIED from an editor, and offers the rest', () => {
    expect(allowedTransitions('editor', 'DRAFT')).toEqual([
      'DRAFT',
      'SOURCE_CHECKED',
      'DISPUTED',
      'DEPRECATED',
    ]);
  });

  it('still offers an editor the status a record already has', () => {
    expect(allowedTransitions('editor', 'VERIFIED')).toContain('VERIFIED');
  });

  it('offers an administrator everything', () => {
    expect(allowedTransitions('admin', 'DRAFT')).toEqual([...REVIEW_STATUSES]);
    expect(allowedTransitions('admin', null)).toEqual([...REVIEW_STATUSES]);
  });
});

describe('the statuses', () => {
  it('each say what they mean', () => {
    for (const status of REVIEW_STATUSES) {
      expect(STATUS_MEANING[status as ReviewStatus].length).toBeGreaterThan(20);
    }
  });
});
