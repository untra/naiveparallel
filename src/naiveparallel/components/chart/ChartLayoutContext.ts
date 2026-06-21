import { createContext, useContext } from "react";
import type { ParallelAxis } from "../../types";
import type { AxisScale, Orientation } from "./scales";

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The resolved geometry of a ParallelChart, shared by every layer that
 * positions against the axes (canvas lines, SVG axes, stat markers, brushes).
 *
 * Two directions matter: the **value** direction (where a value sits on its
 * axis) and the **axis-distribution** direction (where the axes are spread). In
 * horizontal layout axes spread along x and values run along y; in vertical
 * layout axes spread along y and values run along x. `project()` is the single
 * function that turns an (axis, value) pair into a screen point — canvas and
 * SVG both go through it (and through `scaleOf`/`axisPos`), which is what keeps
 * the two layers pixel-aligned.
 */
export interface ChartLayout {
  width: number;
  height: number;
  margins: ChartMargins;
  orientation: Orientation;
  /** The renderable, non-hidden axes in display order. */
  visibleAxes: ParallelAxis[];
  /** Cross-axis pixel coordinate where an axis line sits (x horizontal, y vertical). */
  axisPos(axisId: string): number;
  /** The shared value→pixel scale of an axis (value-direction coordinate). */
  scaleOf(axisId: string): AxisScale;
  /** Full {x,y} screen position of a value on an axis; null when unmappable. */
  project(axisId: string, value: number | string | null): { x: number; y: number } | null;
  /** The value-direction track span in pixels ([top,bottom] horizontal, [left,right] vertical). */
  valueExtent(): [number, number];
  /** The cross-axis span the axis lines are distributed across. */
  axisExtent(): [number, number];
  /** From an element-local pointer point, the value-direction coordinate (y horizontal, x vertical). */
  valueCoord(localX: number, localY: number): number;
  /** From an element-local pointer point, the axis-distribution coordinate (x horizontal, y vertical). */
  axisCoord(localX: number, localY: number): number;
}

export const ChartLayoutContext = createContext<ChartLayout | null>(null);

export function useChartLayout(): ChartLayout {
  const layout = useContext(ChartLayoutContext);
  if (layout === null) {
    throw new Error("useChartLayout must be used within a <ParallelChart> component");
  }
  return layout;
}
