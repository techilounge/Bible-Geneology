import { describe, expect, it } from 'vitest';
import { branding } from './branding';
import {
  CHRONOLOGY_DISCLAIMER,
  DEFAULT_CHRONOLOGY_ID,
  LIFETIME_INTERVAL,
} from './chronology-defaults';

describe('branding configuration', () => {
  it('exposes a product name that components can read instead of hard-coding one', () => {
    expect(branding.productName).toBeTruthy();
    expect(branding.shortName).toBeTruthy();
  });

  it('derives the site url from the environment', () => {
    expect(branding.siteUrl).toMatch(/^https?:\/\//);
  });
});

describe('chronology conventions', () => {
  it('defaults to a single named chronology rather than assuming one exists', () => {
    expect(DEFAULT_CHRONOLOGY_ID).toBe('masoretic');
  });

  it('fixes the lifetime interval convention in one place', () => {
    expect(LIFETIME_INTERVAL).toBe('half-open');
  });

  it('carries the chronology disclaimer required before any calculated date is shown', () => {
    expect(CHRONOLOGY_DISCLAIMER).toContain('may change calculated dates');
  });
});
