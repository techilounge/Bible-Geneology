import '@testing-library/dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

/**
 * jsdom has no ResizeObserver, and the timeline chart measures itself with
 * one. The stub reports nothing, which leaves the chart at its initial
 * width: the right default for a test, because a component whose output
 * depended on a measurement jsdom cannot make would not be testable here.
 */
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
