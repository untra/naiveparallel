import { useCallback, useRef, useState } from "react";
import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { ParallelAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

export interface AxisDragState {
  /** The in-flight horizontal offset of the dragged axis, in px. */
  dx: number;
  dragging: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  };
}

/** Pointer drags shorter than this are clicks (axis selection), not reorders. */
const CLICK_TOLERANCE = 5;

/**
 * Drag-to-reorder on an axis' label region. The dragged axis translates
 * locally while in flight; the new order commits via the context on
 * pointer-up. Hidden axes keep their relative positions.
 */
export function useAxisDrag(axis: ParallelAxis): AxisDragState {
  const { config, reorderAxes } = useNaiveParallel();
  const layout = useChartLayout();
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGElement>) => {
    if (startX.current === null) return;
    const offset = e.clientX - startX.current;
    if (Math.abs(offset) >= CLICK_TOLERANCE) setDragging(true);
    setDx(offset);
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (startX.current === null) return;
      const offset = e.clientX - startX.current;
      startX.current = null;
      setDx(0);
      setDragging(false);
      if (Math.abs(offset) < CLICK_TOLERANCE) return; // a click — let onClick handle it

      // order the visible axes by their (dragged) x positions...
      const finalX = layout.xOf(axis.id) + offset;
      const visibleOrder = [...layout.visibleAxes]
        .map((a) => ({ id: a.id, x: a.id === axis.id ? finalX : layout.xOf(a.id) }))
        .sort((a, b) => a.x - b.x)
        .map((a) => a.id);

      // ...then weave the non-visible axes back in at their original slots
      const visibleSet = new Set(visibleOrder);
      let cursor = 0;
      const orderedIds = config.axes.map((a) =>
        visibleSet.has(a.id) ? visibleOrder[cursor++] : a.id
      );
      reorderAxes(orderedIds);
    },
    [axis.id, config.axes, layout, reorderAxes]
  );

  return { dx, dragging, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}
