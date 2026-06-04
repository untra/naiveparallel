import { useCallback, useEffect, useRef } from "react";
import { useNaiveParallel, useNaiveParallelInteraction } from "../../context/NaiveParallelContext";
import { axisValue } from "../../data/accessors";
import type { DataObj } from "../../types";
import { useChartLayout, type ChartLayout } from "./ChartLayoutContext";

/** Max pointer distance (px) from a polyline to count as hovering it. */
const HOVER_THRESHOLD = 6;

/** A row's interpolated y at pixel x, or null across missing values. */
function rowYAt(row: DataObj, cx: number, layout: ChartLayout): number | null {
  const axes = layout.visibleAxes;
  if (axes.length === 0) return null;

  // find the axes flanking cx
  let left = axes[0];
  let right = axes[axes.length - 1];
  for (let i = 0; i < axes.length - 1; i++) {
    if (layout.xOf(axes[i].id) <= cx && cx <= layout.xOf(axes[i + 1].id)) {
      left = axes[i];
      right = axes[i + 1];
      break;
    }
  }

  const yLeft = layout.scaleOf(left.id).y(axisValue(left, row));
  const yRight = layout.scaleOf(right.id).y(axisValue(right, row));
  if (yLeft === null || yRight === null) return null;

  const xLeft = layout.xOf(left.id);
  const xRight = layout.xOf(right.id);
  if (xRight === xLeft) return yLeft;
  const t = Math.max(0, Math.min(1, (cx - xLeft) / (xRight - xLeft)));
  return yLeft + t * (yRight - yLeft);
}

/**
 * Nearest-row hover detection over the chart container: rAF-throttled
 * pointermove finds the closest polyline among the filtered rows; click
 * selects it. Hover writes only to the interaction context.
 */
export function useRowHover() {
  const { filteredData } = useNaiveParallel();
  const { setHovered, setSelected } = useNaiveParallelInteraction();
  const layout = useChartLayout();
  const hovered = useRef<DataObj | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      if (frame.current !== null) return; // one detection per frame
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        let best: DataObj | null = null;
        let bestDistance = HOVER_THRESHOLD;
        for (const row of filteredData) {
          const y = rowYAt(row, cx, layout);
          if (y === null) continue;
          const distance = Math.abs(y - cy);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = row;
          }
        }
        if (best !== hovered.current) {
          hovered.current = best;
          setHovered(best);
        }
      });
    },
    [filteredData, layout, setHovered]
  );

  const onPointerLeave = useCallback(() => {
    if (hovered.current !== null) {
      hovered.current = null;
      setHovered(null);
    }
  }, [setHovered]);

  const onClick = useCallback(() => {
    setSelected(hovered.current);
  }, [setSelected]);

  return { onPointerMove, onPointerLeave, onClick };
}
