import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignOutCleanup } from './SignOutCleanup';

/**
 * The browser half of the Phase 13 exit gate. The browser suite proves it
 * against a real service worker; these cover the cases a real browser
 * will not reproduce on demand: storage that throws, and a browser with
 * no Cache API at all. Signing out has to work in both.
 */
function withCaches(value: unknown): void {
  Object.defineProperty(window, 'caches', {
    value,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  Reflect.deleteProperty(window as unknown as Record<string, unknown>, 'caches');
});

describe('clearing this browser on sign out', () => {
  it('removes this site’s keys and leaves other sites’ alone', async () => {
    window.localStorage.setItem('bible-timeline-explorer.attempts.v1', '[]');
    window.localStorage.setItem('bible-timeline-explorer.preferences', '{}');
    window.localStorage.setItem('something-else', 'keep me');

    render(<SignOutCleanup />);

    await waitFor(() => {
      expect(screen.getByTestId('cleanup').getAttribute('data-cleared')).toBe('yes');
    });
    expect(window.localStorage.getItem('bible-timeline-explorer.attempts.v1')).toBeNull();
    expect(window.localStorage.getItem('bible-timeline-explorer.preferences')).toBeNull();
    expect(window.localStorage.getItem('something-else')).toBe('keep me');
  });

  it('deletes every cache when there is a Cache API', async () => {
    const deleted: string[] = [];
    withCaches({
      keys: () => Promise.resolve(['shell-v1', 'assets-v1']),
      delete: (name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
    });

    render(<SignOutCleanup />);

    await waitFor(() => {
      expect(screen.getByTestId('cleanup').getAttribute('data-cleared')).toBe('yes');
    });
    expect(deleted).toEqual(['shell-v1', 'assets-v1']);
  });

  it('still finishes when the caches cannot be read', async () => {
    withCaches({
      keys: () => Promise.reject(new Error('no')),
      delete: () => Promise.resolve(true),
    });

    render(<SignOutCleanup />);

    await waitFor(() => {
      expect(screen.getByTestId('cleanup').getAttribute('data-cleared')).toBe('yes');
    });
  });

  it('still finishes when storage is blocked, as in a private window', async () => {
    vi.spyOn(window.localStorage, 'key').mockImplementation(() => {
      throw new Error('storage is blocked');
    });

    render(<SignOutCleanup />);

    await waitFor(() => {
      expect(screen.getByTestId('cleanup').getAttribute('data-cleared')).toBe('yes');
    });
  });
});
