import { useCallback, useRef, useState } from "react";
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

/**
 * Pointer-event brushing for a numerical axis track: the in-flight extent is
 * local state (only the brush rect re-renders); the range filter commits via
 * the context on pointer-up, which is when the canvas redraws.
 */
export function useBrush(axis: NumericalAxis): BrushState {
  const { setFilter } = useNaiveParallel();
  const layout = useChartLayout();
  const [extent, setExtent] = useState<[number, number] | null>(null);
  const startY = useRef<number | null>(null);

  const localY = (e: React.PointerEvent<SVGElement>) => {
    const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const top = layout.margins.top;
    const bottom = layout.height - layout.margins.bottom;
    return Math.max(top, Math.min(bottom, e.clientY - rect.top));
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const y = localY(e);
      startY.current = y;
      setExtent([y, y]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (startY.current === null) return;
      const y = localY(e);
      setExtent([Math.min(startY.current, y), Math.max(startY.current, y)]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (startY.current === null) return;
      const y = localY(e);
      const from = startY.current;
      startY.current = null;
      setExtent(null);

      if (Math.abs(y - from) < CLICK_TOLERANCE) {
        setFilter(axis.id, undefined); // click clears the brush
        return;
      }
      const scale = layout.scaleOf(axis.id);
      const top = Math.min(from, y);
      const bottom = Math.max(from, y);
      // pixel top is the high value (numerical scales render high at top)
      const hi = scale.invert(top);
      const lo = scale.invert(bottom);
      if (lo === null || hi === null) return;
      setFilter(axis.id, { kind: "numeric", min: Math.min(lo, hi), max: Math.max(lo, hi) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, layout, setFilter]
  );

  return {
    extent,
    brushing: extent !== null, // extent is set for the whole pointer-down..up window
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
