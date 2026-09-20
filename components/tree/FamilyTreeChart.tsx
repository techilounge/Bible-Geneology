'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { TreeEdge, TreeNode } from '@/lib/graph/tree-layout';
import {
  fitViewport,
  panViewport,
  pinchDistance,
  pinchMidpoint,
  zoomViewport,
  type Viewport,
} from '@/lib/graph/tree-viewport';
import type { ConfidenceLevel } from '@/lib/domain';

/**
 * The drawn family tree.
 *
 * `aria-hidden`, like the timeline's chart, because TreeOutline beside it
 * says the same thing in a nested list and a screen reader should hear it
 * once. What this adds is the shape: who is in which generation, and which
 * lines are recorded with what confidence.
 *
 * It receives nodes and edges and nothing else. It has never seen a
 * relationship record, so it cannot draw a line the dataset does not hold.
 */
const NODE_WIDTH = 132;
const NODE_HEIGHT = 34;
const COLUMN_GAP = 24;
const ROW_GAP = 64;

const EDGE_COLOUR: Record<ConfidenceLevel, string> = {
  EXPLICIT: 'var(--color-confidence-explicit)',
  DERIVED: 'var(--color-confidence-derived)',
  APPROXIMATE: 'var(--color-confidence-approximate)',
  DISPUTED: 'var(--color-confidence-disputed)',
  UNKNOWN: 'var(--color-confidence-unknown)',
};

export interface FamilyTreeChartProps {
  rootId: string;
  nodes: readonly TreeNode[];
  edges: readonly TreeEdge[];
  names: Readonly<Record<string, string>>;
  height?: number;
}

export function FamilyTreeChart({
  rootId,
  nodes,
  edges,
  names,
  height = 420,
}: FamilyTreeChartProps) {
  const hintId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);

  const [size, setSize] = useState({ width: 800, height });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });

  const placed = useMemo(() => {
    const minDepth = Math.min(...nodes.map((node) => node.depth));
    return new Map(
      nodes.map((node) => [
        node.personId,
        {
          x: node.order * (NODE_WIDTH + COLUMN_GAP),
          y: (node.depth - minDepth) * ROW_GAP,
          node,
        },
      ]),
    );
  }, [nodes]);

  const content = useMemo(() => {
    const xs = [...placed.values()].map((entry) => entry.x);
    const ys = [...placed.values()].map((entry) => entry.y);
    return {
      width: Math.max(...xs) + NODE_WIDTH,
      height: Math.max(...ys) + NODE_HEIGHT,
    };
  }, [placed]);

  const fit = useCallback(() => {
    setViewport(fitViewport(size, content));
  }, [size, content]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  useEffect(fit, [fit]);

  // A non-passive listener, because a passive one cannot stop the page
  // scrolling when someone means to zoom the tree.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setViewport((current) =>
        zoomViewport(
          current,
          event.deltaY < 0 ? 1.1 : 1 / 1.1,
          event.clientX - box.left,
          event.clientY - box.top,
        ),
      );
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  const local = (event: React.PointerEvent) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer can already be gone by the time this runs, and capture
      // is an improvement rather than a requirement: dragging still works
      // without it, it just stops tracking if the finger leaves the box.
    }
    pointers.current.set(event.pointerId, local(event));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (a && b) pinch.current = pinchDistance(a, b);
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const next = local(event);
    pointers.current.set(event.pointerId, next);

    const points = [...pointers.current.values()];

    if (points.length >= 2) {
      const [a, b] = points;
      if (!a || !b) return;
      const distance = pinchDistance(a, b);
      const started = pinch.current;
      if (started !== null && started > 0) {
        const centre = pinchMidpoint(a, b);
        setViewport((current) =>
          zoomViewport(current, distance / started, centre.x, centre.y),
        );
      }
      pinch.current = distance;
      return;
    }

    setViewport((current) => panViewport(current, next.x - previous.x, next.y - previous.y));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const centre = { x: size.width / 2, y: size.height / 2 };
    const actions: Record<string, () => void> = {
      ArrowLeft: () => setViewport((v) => panViewport(v, 40, 0)),
      ArrowRight: () => setViewport((v) => panViewport(v, -40, 0)),
      ArrowUp: () => setViewport((v) => panViewport(v, 0, 40)),
      ArrowDown: () => setViewport((v) => panViewport(v, 0, -40)),
      '+': () => setViewport((v) => zoomViewport(v, 1.25, centre.x, centre.y)),
      '=': () => setViewport((v) => zoomViewport(v, 1.25, centre.x, centre.y)),
      '-': () => setViewport((v) => zoomViewport(v, 1 / 1.25, centre.x, centre.y)),
      Home: fit,
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Control
          onClick={() => setViewport((v) => zoomViewport(v, 1.25, size.width / 2, size.height / 2))}
          label="Zoom in"
          symbol="+"
        />
        <Control
          onClick={() => setViewport((v) => zoomViewport(v, 1 / 1.25, size.width / 2, size.height / 2))}
          label="Zoom out"
          symbol="−"
        />
        <Control onClick={fit} label="Fit the whole tree" symbol="Fit" />
        <p
          data-testid="tree-scale"
          className="ml-auto font-mono text-sm tabular-nums text-[var(--color-text-muted)]"
        >
          {Math.round(viewport.scale * 100)}%
        </p>
      </div>

      <p id={hintId} className="sr-only">
        A drawing of the same family listed below. Drag or use the arrow keys to move
        around it, pinch or use plus and minus to zoom, and Home to fit the whole tree.
      </p>

      <div
        ref={containerRef}
        data-testid="tree-chart"
        role="group"
        aria-label="Family tree diagram"
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ height, touchAction: 'none' }}
        className="w-full cursor-grab overflow-hidden rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
      >
        <svg
          width={size.width}
          height={height}
          aria-hidden="true"
          focusable="false"
          className="block"
        >
          <g
            data-testid="tree-transform"
            transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}
          >
            {edges.map((edge) => {
              const from = placed.get(edge.sourcePersonId);
              const to = placed.get(edge.targetPersonId);
              if (!from || !to) return null;
              // Marriage is drawn dashed, descent solid. The classification
              // comes with the edge; this file does not know what a
              // relationship type is called.
              const dashed = !edge.isDescent;
              return (
                <line
                  key={`${edge.sourcePersonId}-${edge.targetPersonId}-${edge.relationshipType}`}
                  data-testid="tree-edge"
                  data-edge={`${edge.sourcePersonId}|${edge.targetPersonId}|${edge.relationshipType}`}
                  data-descent={String(edge.isDescent)}
                  x1={from.x + NODE_WIDTH / 2}
                  y1={from.y + NODE_HEIGHT / 2}
                  x2={to.x + NODE_WIDTH / 2}
                  y2={to.y + NODE_HEIGHT / 2}
                  stroke={EDGE_COLOUR[edge.confidence]}
                  strokeWidth={dashed ? 1 : 1.5}
                  strokeDasharray={dashed ? '3 3' : undefined}
                />
              );
            })}

            {[...placed.values()].map(({ x, y, node }) => (
              <g key={node.personId} data-testid="tree-node" data-person={node.personId}>
                <rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={6}
                  fill="var(--color-surface-overlay)"
                  stroke={
                    node.personId === rootId
                      ? 'var(--color-accent)'
                      : 'var(--color-border-subtle)'
                  }
                  strokeWidth={node.personId === rootId ? 2 : 1}
                />
                <text
                  x={x + NODE_WIDTH / 2}
                  y={y + NODE_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className="fill-[var(--color-text-primary)] text-[12px]"
                >
                  {names[node.personId] ?? node.personId}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function Control({
  onClick,
  label,
  symbol,
}: {
  onClick: () => void;
  label: string;
  symbol: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-[var(--color-surface-overlay)] px-3 text-sm font-medium hover:bg-[var(--color-border-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">{symbol}</span>
    </button>
  );
}
