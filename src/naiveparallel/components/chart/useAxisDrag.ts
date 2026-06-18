import { useCallback, useRef, useState } from "react";
import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { ParallelAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

export interface AxisDragState {
  /**
   * The in-flight offset of the dragged axis along the axis-distribution
   * direction, in px (apply to x horizontally, to y vertically — see
   * {@link AxisDragState.dx}/{@link AxisDragState.dy}).
   */
  offset: number;
  /** In-flight x offset (the offset horizontally, 0 vertically). */
  dx: number;
  /** In-flight y offset (the offset vertically, 0 horizontally). */
  dy: number;
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
  const [offset, setOffset] = useState(0);
  const start = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // axes are dragged along the axis-distribution direction: x horizontal, y vertical
  const axisClient = (e: React.PointerEvent<SVGElement>) =>
    layout.orientation === "vertical" ? e.clientY : e.clientX;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      start.current = axisClient(e);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.orientation]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (start.current === null) return;
      const delta = axisClient(e) - start.current;
      if (Math.abs(delta) >= CLICK_TOLERANCE) setDragging(true);
      setOffset(delta);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout.orientation]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (start.current === null) return;
      const delta = axisClient(e) - start.current;
      start.current = null;
      setOffset(0);
      setDragging(false);
      if (Math.abs(delta) < CLICK_TOLERANCE) return; // a click — let onClick handle it

      // order the visible axes by their (dragged) axis-distribution positions...
      const finalPos = layout.axisPos(axis.id) + delta;
      const visibleOrder = [...layout.visibleAxes]
        .map((a) => ({ id: a.id, pos: a.id === axis.id ? finalPos : layout.axisPos(a.id) }))
        .sort((a, b) => a.pos - b.pos)
        .map((a) => a.id);

      // ...then weave the non-visible axes back in at their original slots
      const visibleSet = new Set(visibleOrder);
      let cursor = 0;
      const orderedIds = config.axes.map((a) =>
        visibleSet.has(a.id) ? visibleOrder[cursor++] : a.id
      );
      reorderAxes(orderedIds);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, config.axes, layout, reorderAxes]
  );

  const vertical = layout.orientation === "vertical";
  return {
    offset,
    dx: vertical ? 0 : offset,
    dy: vertical ? offset : 0,
    dragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
