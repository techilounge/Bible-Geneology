import { describe, expect, it } from 'vitest';
import { branding } from './branding';
import {
  ALTERNATE_CHRONOLOGY_ID,
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
  it('keeps the alternate Terah reading addressable and distinct from the default', () => {
    // Genesis 11:26 read as Abraham's birth offset is an interpretation, not an
    // explicit statement. It survives as a named variant so nothing assumes it.
    expect(ALTERNATE_CHRONOLOGY_ID).toBe('masoretic-gen11-26');
    expect(ALTERNATE_CHRONOLOGY_ID).not.toBe(DEFAULT_CHRONOLOGY_ID);
  });
});
