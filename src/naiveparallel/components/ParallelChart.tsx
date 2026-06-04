import { scalePoint } from "d3-scale";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import { AxisSvg } from "./chart/AxisSvg";
import {
  ChartLayoutContext,
  useChartLayout,
  type ChartLayout,
  type ChartMargins,
} from "./chart/ChartLayoutContext";
import { HoverCanvas } from "./chart/HoverCanvas";
import { LinesCanvas } from "./chart/LinesCanvas";
import { buildScale, type AxisScale } from "./chart/scales";
import { StatMarkers } from "./chart/StatMarkers";
import { useRowHover } from "./chart/useRowHover";

/** The stacked render layers; a separate component so hooks can read the layout context. */
function ChartLayers() {
  const layout = useChartLayout();
  const hover = useRowHover();
  return (
    <div
      className="np-chart-layers"
      style={{ position: "absolute", inset: 0 }}
      onPointerMove={hover.onPointerMove}
      onPointerLeave={hover.onPointerLeave}
      onClick={hover.onClick}
    >
      <LinesCanvas />
      <HoverCanvas />
      <svg
        className="np-chart-svg"
        width={layout.width}
        height={layout.height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        {layout.visibleAxes.map((axis) => (
          <AxisSvg key={axis.id} axis={axis} />
        ))}
        <StatMarkers />
      </svg>
    </div>
  );
}

export interface ParallelChartProps {
  /** Chart height in px; width follows the container. */
  height?: number;
  margins?: Partial<ChartMargins>;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_MARGINS: ChartMargins = { top: 44, right: 48, bottom: 16, left: 48 };

/**
 * The parallel coordinates chart: a canvas line layer underneath
 * React-rendered SVG axes. Both layers position through the shared
 * ChartLayout scales, so they always align.
 */
export function ParallelChart(props: ParallelChartProps) {
  const { height = 480, className, style } = props;
  const { axes } = useNaiveParallel();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // follow the container's width
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    setWidth(container.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const margins = useMemo<ChartMargins>(
    () => ({ ...DEFAULT_MARGINS, ...props.margins }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.margins?.top, props.margins?.right, props.margins?.bottom, props.margins?.left]
  );

  const layout = useMemo<ChartLayout | null>(() => {
    if (width <= 0) return null;
    const visibleAxes = axes.filter(
      (axis) => !axis.hidden && (axis.kind === "numerical" || axis.renderable)
    );
    const x = scalePoint<string>()
      .domain(visibleAxes.map((a) => a.id))
      .range([margins.left, width - margins.right]);
    const range: [number, number] = [margins.top, height - margins.bottom];
    const scales = new Map<string, AxisScale>(
      visibleAxes.map((axis) => [axis.id, buildScale(axis, range)])
    );
    return {
      width,
      height,
      margins,
      visibleAxes,
      xOf: (axisId) => x(axisId) ?? 0,
      scaleOf: (axisId) => {
        const scale = scales.get(axisId);
        if (!scale) throw new Error(`no scale for axis "${axisId}"`);
        return scale;
      },
    };
  }, [axes, width, height, margins]);

  return (
    <div
      ref={containerRef}
      className={`np-chart${className ? ` ${className}` : ""}`}
      data-testid="np-chart"
      style={{ position: "relative", width: "100%", height, ...style }}
    >
      {layout && (
        <ChartLayoutContext.Provider value={layout}>
          <ChartLayers />
        </ChartLayoutContext.Provider>
      )}
    </div>
  );
}
