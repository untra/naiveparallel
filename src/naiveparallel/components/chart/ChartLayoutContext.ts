import { createContext, useContext } from "react";
import type { ParallelAxis } from "../../types";
import type { AxisScale } from "./scales";

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * The resolved geometry of a ParallelChart, shared by every layer that
 * positions against the axes (canvas lines, SVG axes, stat markers, brushes).
 */
export interface ChartLayout {
  width: number;
  height: number;
  margins: ChartMargins;
  /** The renderable, non-hidden axes in display order. */
  visibleAxes: ParallelAxis[];
  /** Pixel x of an axis line. */
  xOf(axisId: string): number;
  /** The shared value→pixel scale of an axis. */
  scaleOf(axisId: string): AxisScale;
}

export const ChartLayoutContext = createContext<ChartLayout | null>(null);

export function useChartLayout(): ChartLayout {
  const layout = useContext(ChartLayoutContext);
  if (layout === null) {
    throw new Error("useChartLayout must be used within a <ParallelChart> component");
  }
  return layout;
}
