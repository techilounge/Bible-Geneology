/**
 * Who may do what to a record, and what a change has to carry.
 *
 * These are the rules the database enforces, stated once more in a place
 * the application can ask before it tries. That duplication is
 * deliberate and it is not the "duplicated business logic" section 64
 * forbids: the database's copy is the one that decides, and this one
 * exists so a reviewer gets a sentence explaining the refusal instead of
 * a Postgres exception. If the two ever disagree, the database wins and
 * `tests/db/governance.test.ts` is what proves which is which.
 */
export type AppRole = 'user' | 'editor' | 'admin';

export type ReviewStatus =
  'DRAFT' | 'SOURCE_CHECKED' | 'VERIFIED' | 'DISPUTED' | 'DEPRECATED';

export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  'DRAFT',
  'SOURCE_CHECKED',
  'VERIFIED',
  'DISPUTED',
  'DEPRECATED',
] as const;

/** What each status means, in the words the review queue uses. */
export const STATUS_MEANING: Readonly<Record<ReviewStatus, string>> = {
  DRAFT: 'Entered, not yet checked against a source.',
  SOURCE_CHECKED: 'Checked against a source, waiting for a second look.',
  VERIFIED: 'Checked and signed off. This is what the site shows.',
  DISPUTED: 'The sources disagree, and the record says so rather than choosing.',
  DEPRECATED: 'Superseded. Kept so the history still reads.',
};

export const isStaff = (role: AppRole): boolean => role === 'editor' || role === 'admin';
export const canReachAdmin = (role: AppRole): boolean => isStaff(role);
export const canEdit = (role: AppRole): boolean => isStaff(role);
/** Only an administrator signs a record off. Requirement section 48. */
export const canVerify = (role: AppRole): boolean => role === 'admin';

export interface ProposedChange {
  role: AppRole;
  /** The status the record has now, or null when it is being created. */
  from: ReviewStatus | null;
  to: ReviewStatus;
  /** Whether any field other than the status is changing. */
  changesFields: boolean;
  reason: string;
  /** What the change was checked against. */
  sources: readonly string[];
}

export interface Refusal {
  ok: false;
  problem: string;
}

export type Judgement = { ok: true } | Refusal;

const blank = (value: string): boolean => value.trim().length === 0;

/**
 * Whether a proposed change is allowed, and if not, why in one sentence.
 *
 * The order matters: permission first, because telling somebody their
 * reason is too short when they were never allowed to make the change is
 * a worse answer than telling them they cannot make it.
 */
export function judgeChange(change: ProposedChange): Judgement {
  const { role, from, to, changesFields, reason, sources } = change;

  if (!canEdit(role)) {
    return {
      ok: false,
      problem: 'Only an editor or an administrator may change a record.',
    };
  }

  const promoting = to === 'VERIFIED' && from !== 'VERIFIED';
  const editingVerified = from === 'VERIFIED' && to === 'VERIFIED' && changesFields;
  const demoting = from === 'VERIFIED' && to !== 'VERIFIED';

  if (promoting && !canVerify(role)) {
    return { ok: false, problem: 'Only an administrator may mark a record VERIFIED.' };
  }

  if (promoting || editingVerified || demoting) {
    if (blank(reason)) {
      return {
        ok: false,
        problem: promoting
          ? 'Marking a record VERIFIED needs a reason saying what was checked.'
          : 'Changing a VERIFIED record needs a reason saying why.',
      };
    }
    if (sources.length === 0 || sources.every(blank)) {
      return {
        ok: false,
        problem:
          'Say what the change was checked against. A change to a verified record needs a source.',
      };
    }
  }

  if (!promoting && !editingVerified && !demoting && !changesFields && from === to) {
    return { ok: false, problem: 'Nothing has changed.' };
  }

  return { ok: true };
}

/** The statuses this role may move a record to, from where it is now. */
export function allowedTransitions(
  role: AppRole,
  from: ReviewStatus | null,
): ReviewStatus[] {
  if (!canEdit(role)) return [];
  return REVIEW_STATUSES.filter((status) => {
    if (status === from) return true;
    if (status === 'VERIFIED') return canVerify(role);
    return true;
  });
}
