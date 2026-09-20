import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fitViewport,
  panViewport,
  pinchDistance,
  pinchMidpoint,
  zoomViewport,
} from '../tree-viewport';

describe('clampScale', () => {
  it('keeps the scale inside the usable range', () => {
    expect(clampScale(0.001)).toBe(MIN_SCALE);
    expect(clampScale(100)).toBe(MAX_SCALE);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe('panViewport', () => {
  it('moves by the delta and leaves the scale alone', () => {
    expect(panViewport({ x: 10, y: 20, scale: 2 }, 5, -5)).toEqual({
      x: 15,
      y: 15,
      scale: 2,
    });
  });
});

describe('zoomViewport', () => {
  it('keeps the point it zooms about under the same pixel', () => {
    const before = { x: 0, y: 0, scale: 1 };
    const after = zoomViewport(before, 2, 100, 50);

    // The content point under (100, 50) before the zoom is still there.
    const contentX = (100 - before.x) / before.scale;
    expect(after.x + contentX * after.scale).toBeCloseTo(100);
  });

  it('does not drift sideways when the zoom hits its limit', () => {
    const at = { x: 0, y: 0, scale: MAX_SCALE };
    const after = zoomViewport(at, 4, 100, 50);
    expect(after.scale).toBe(MAX_SCALE);
    expect(after).toEqual(at);
  });

  it('clamps a zoom out at the minimum', () => {
    expect(zoomViewport({ x: 0, y: 0, scale: MIN_SCALE }, 0.1, 0, 0).scale).toBe(
      MIN_SCALE,
    );
  });
});

describe('pinch geometry', () => {
  it('measures the distance between two fingers', () => {
    expect(pinchDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('finds the point between them', () => {
    expect(pinchMidpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 });
  });
});

describe('fitViewport', () => {
  it('shrinks a tree that is wider than the space and centres it', () => {
    const fitted = fitViewport({ width: 100, height: 100 }, { width: 200, height: 50 });
    expect(fitted.scale).toBe(0.5);
    expect(fitted.x).toBe(0);
    expect(fitted.y).toBe(37.5);
  });

  it('never magnifies a small tree to fill the screen', () => {
    const fitted = fitViewport({ width: 800, height: 600 }, { width: 100, height: 60 });
    expect(fitted.scale).toBe(1);
  });

  it('survives being asked to fit nothing', () => {
    expect(fitViewport({ width: 100, height: 100 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      scale: 1,
    });
  });
});
