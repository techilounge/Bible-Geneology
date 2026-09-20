/**
 * Pan and zoom maths for the family tree.
 *
 * Pure, and here rather than in the pointer handlers for the reason
 * `clampDomain` is not in the timeline's handlers: a transform assembled
 * inside an event listener is a transform nothing can test, and the failure
 * mode is a tree that vanishes off the edge of its own canvas.
 */
export interface Viewport {
  /** Translation in screen pixels, applied before the scale. */
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.25;
export const MAX_SCALE = 4;

export function clampScale(scale: number): number {
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
}

export function panViewport(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
}

/**
 * Zooms about a point in screen space, so whatever is under the pointer or
 * between two fingers stays there.
 */
export function zoomViewport(
  viewport: Viewport,
  factor: number,
  originX: number,
  originY: number,
): Viewport {
  const scale = clampScale(viewport.scale * factor);
  // The actual factor after clamping, so a zoom that hits the limit does
  // not also drift sideways.
  const applied = scale / viewport.scale;
  return {
    scale,
    x: originX - (originX - viewport.x) * applied,
    y: originY - (originY - viewport.y) * applied,
  };
}

/** Distance between two pointers, for a pinch. */
export function pinchDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pinchMidpoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * The viewport that fits the whole tree in the space available, centred,
 * never magnified past 1: a three-person family blown up to fill a desktop
 * screen looks like an error.
 */
export function fitViewport(
  available: { width: number; height: number },
  content: { width: number; height: number },
): Viewport {
  if (content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0, scale: 1 };
  }
  const scale = clampScale(
    Math.min(1, available.width / content.width, available.height / content.height),
  );
  return {
    scale,
    x: (available.width - content.width * scale) / 2,
    y: (available.height - content.height * scale) / 2,
  };
}
