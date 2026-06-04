import { useCallback, useEffect, useRef, useState } from "react";
import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { NumericalAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

export interface BrushState {
  /** The in-flight brush extent in pixels [top, bottom], or null. */
  extent: [number, number] | null;
  /** True while the pointer is down. */
  brushing: boolean;
  /** Pointer handlers to spread onto the brush track element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  };
}

/** Pixel drags shorter than this clear the filter instead (a click). */
const CLICK_TOLERANCE = 3;

interface Gesture {
  /** "new" draws a fresh extent; "move" slides the committed one, size preserved. */
  mode: "new" | "move";
  startY: number;
  /** move mode: pointer offset from the extent's top edge. */
  grabOffset: number;
  /** move mode: the extent's pixel size, which never changes. */
  size: number;
  moved: boolean;
}

/**
 * Pointer-event brushing for a numerical axis track, in the spirit of the
 * reference d3.brushY ('brush end' + rAF-coalesced updates):
 *
 * - dragging an empty track draws a new range;
 * - grabbing an existing brushed range slides it along the axis, keeping
 *   its size;
 * - the range filter applies **live** while dragging (one rAF-throttled
 *   commit per frame), so rows, stats, and markers update immediately;
 * - brushing an axis selects it (the last-brushed axis is the active one);
 * - a click on the empty track clears the filter; a click on the brushed
 *   range leaves it untouched.
 */
export function useBrush(axis: NumericalAxis): BrushState {
  const { filters, setFilter, selectAxis } = useNaiveParallel();
  const layout = useChartLayout();
  const [extent, setExtent] = useState<[number, number] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const pendingExtent = useRef<[number, number] | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  const trackTop = layout.margins.top;
  const trackBottom = layout.height - layout.margins.bottom;
  const scale = layout.scaleOf(axis.id);

  const localY = (e: React.PointerEvent<SVGElement>) => {
    const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    return Math.max(trackTop, Math.min(trackBottom, e.clientY - rect.top));
  };

  const filterOf = (pixelExtent: [number, number]) => {
    // pixel top is the high value (numerical scales render high at top)
    const hi = scale.invert(pixelExtent[0]);
    const lo = scale.invert(pixelExtent[1]);
    if (lo === null || hi === null) return undefined;
    return { kind: "numeric" as const, min: Math.min(lo, hi), max: Math.max(lo, hi) };
  };

  /** rAF-throttled live filter application (port of the reference scheduleUpdate). */
  const applyLive = useCallback(
    (pixelExtent: [number, number]) => {
      pendingExtent.current = pixelExtent;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (pendingExtent.current === null) return;
        const filter = filterOf(pendingExtent.current);
        if (filter) setFilter(axis.id, filter);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, setFilter, layout]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const y = localY(e);
      selectAxis(axis.id); // the brushed axis becomes the active/selected one

      const committed = filters[axis.id];
      if (committed?.kind === "numeric") {
        const top = scale.y(committed.max);
        const bottom = scale.y(committed.min);
        if (top !== null && bottom !== null && y >= top && y <= bottom) {
          // grabbed the existing range: slide it, size preserved
          gesture.current = {
            mode: "move",
            startY: y,
            grabOffset: y - top,
            size: bottom - top,
            moved: false,
          };
          setExtent([top, bottom]);
          return;
        }
      }
      gesture.current = { mode: "new", startY: y, grabOffset: 0, size: 0, moved: false };
      setExtent([y, y]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, filters, layout, selectAxis]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      const y = localY(e);
      if (Math.abs(y - g.startY) >= CLICK_TOLERANCE) g.moved = true;

      let next: [number, number];
      if (g.mode === "move") {
        const top = Math.max(trackTop, Math.min(trackBottom - g.size, y - g.grabOffset));
        next = [top, top + g.size];
      } else {
        next = [Math.min(g.startY, y), Math.max(g.startY, y)];
      }
      setExtent(next);
      // live filtering: rows in the changed range show up right away —
      // but not before a new-brush drag is distinguishable from a click
      if (g.moved) applyLive(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyLive, layout]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      gesture.current = null;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      pendingExtent.current = null;
      const y = localY(e);
      const finalExtent = extent;
      setExtent(null);

      if (!g.moved && Math.abs(y - g.startY) < CLICK_TOLERANCE) {
        // a click: clears the filter on the empty track, leaves a grabbed range alone
        if (g.mode === "new") setFilter(axis.id, undefined);
        return;
      }
      if (finalExtent) {
        const filter = filterOf(finalExtent);
        if (filter) setFilter(axis.id, filter);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, extent, layout, setFilter]
  );

  return {
    extent,
    brushing: extent !== null, // extent is set for the whole pointer-down..up window
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
