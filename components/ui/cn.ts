/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx`: the whole need here is one line, and a dependency
 * whose job is one line is a dependency to audit and update forever.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
