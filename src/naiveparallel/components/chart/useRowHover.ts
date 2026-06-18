import { useCallback, useEffect, useRef } from "react";
import { useNaiveParallel, useNaiveParallelInteraction } from "../../context/NaiveParallelContext";
import { axisValue } from "../../data/accessors";
import type { DataObj } from "../../types";
import { useChartLayout, type ChartLayout } from "./ChartLayoutContext";

/** Max pointer distance (px) from a polyline to count as hovering it. */
const HOVER_THRESHOLD = 6;

/**
 * A row's interpolated value-direction coordinate at a given axis-distribution
 * coordinate, or null across missing values. Both inputs/outputs are in the
 * layout's coordinate frame (y horizontal, x vertical) — caller compares the
 * result to the pointer's value-direction coordinate.
 */
function rowValueAt(row: DataObj, axisAt: number, layout: ChartLayout): number | null {
  const axes = layout.visibleAxes;
  if (axes.length === 0) return null;

  // find the axes flanking the pointer along the axis-distribution direction
  let left = axes[0];
  let right = axes[axes.length - 1];
  for (let i = 0; i < axes.length - 1; i++) {
    if (layout.axisPos(axes[i].id) <= axisAt && axisAt <= layout.axisPos(axes[i + 1].id)) {
      left = axes[i];
      right = axes[i + 1];
      break;
    }
  }

  const vLeft = layout.scaleOf(left.id).y(axisValue(left, row));
  const vRight = layout.scaleOf(right.id).y(axisValue(right, row));
  if (vLeft === null || vRight === null) return null;

  const posLeft = layout.axisPos(left.id);
  const posRight = layout.axisPos(right.id);
  if (posRight === posLeft) return vLeft;
  const t = Math.max(0, Math.min(1, (axisAt - posLeft) / (posRight - posLeft)));
  return vLeft + t * (vRight - vLeft);
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
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const axisAt = layout.axisCoord(localX, localY);
      const valueAt = layout.valueCoord(localX, localY);
      if (frame.current !== null) return; // one detection per frame
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        let best: DataObj | null = null;
        let bestDistance = HOVER_THRESHOLD;
        for (const row of filteredData) {
          const v = rowValueAt(row, axisAt, layout);
          if (v === null) continue;
          const distance = Math.abs(v - valueAt);
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
