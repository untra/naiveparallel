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
import { buildScale, type AxisScale, type Orientation } from "./chart/scales";
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
  /**
   * Layout direction. "horizontal" draws axes as vertical columns (desktop);
   * "vertical" stacks axes as horizontal lines top-to-bottom (mobile). "auto"
   * (the default) picks vertical on a portrait viewport, horizontal otherwise.
   */
  layout?: Orientation | "auto";
  /**
   * Pixel spacing between adjacent axes. In vertical layout it sets the per-axis
   * pitch (the chart height is derived from it); defaults to a touch-friendly
   * value vertically and to even width distribution horizontally.
   */
  axisSpacing?: number;
  /**
   * Chart height in px; width follows the container. Ignored in vertical layout,
   * whose height is derived from the axis count × spacing.
   */
  height?: number;
  margins?: Partial<ChartMargins>;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_MARGINS_H: ChartMargins = { top: 44, right: 48, bottom: 16, left: 48 };
const DEFAULT_MARGINS_V: ChartMargins = { top: 16, right: 24, bottom: 24, left: 96 };
/** Per-axis pitch (px) in vertical layout when axisSpacing is not given. */
const DEFAULT_SPACING_V = 88;

/** Whether the viewport is portrait (taller than wide) — drives layout="auto". */
function isPortraitViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerHeight > window.innerWidth;
}

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
  const [portrait, setPortrait] = useState(isPortraitViewport);

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

  // track viewport orientation so layout="auto" can react to rotation/resize
  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => setPortrait(isPortraitViewport());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  const orientation: Orientation =
    props.layout === "vertical" || props.layout === "horizontal"
      ? props.layout
      : portrait
        ? "vertical"
        : "horizontal";

  const margins = useMemo<ChartMargins>(
    () => ({ ...(orientation === "vertical" ? DEFAULT_MARGINS_V : DEFAULT_MARGINS_H), ...props.margins }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orientation, props.margins?.top, props.margins?.right, props.margins?.bottom, props.margins?.left]
  );

  const spacing = props.axisSpacing ?? (orientation === "vertical" ? DEFAULT_SPACING_V : 0);

  const layout = useMemo<ChartLayout | null>(() => {
    if (width <= 0) return null;
    const visibleAxes = axes.filter(
      (axis) => !axis.hidden && (axis.kind === "numerical" || axis.renderable)
    );
    const n = visibleAxes.length;

    // vertical height grows with the axis count so each axis gets a comfortable
    // touch band and the page scrolls on mobile; horizontal uses the height prop
    const resolvedHeight =
      orientation === "vertical" ? margins.top + margins.bottom + spacing * n : height;

    // axis-distribution scale (cross direction) and value-direction range
    const axisRange: [number, number] =
      orientation === "vertical"
        ? [margins.top, resolvedHeight - margins.bottom]
        : [margins.left, width - margins.right];
    const valueRange: [number, number] =
      orientation === "vertical"
        ? [margins.left, width - margins.right]
        : [margins.top, resolvedHeight - margins.bottom];

    const pos = scalePoint<string>()
      .domain(visibleAxes.map((a) => a.id))
      .range(axisRange);
    if (orientation === "vertical") pos.padding(0.5);
    const scales = new Map<string, AxisScale>(
      visibleAxes.map((axis) => [axis.id, buildScale(axis, valueRange, orientation)])
    );

    const axisPos = (axisId: string) => pos(axisId) ?? 0;
    const scaleOf = (axisId: string) => {
      const scale = scales.get(axisId);
      if (!scale) throw new Error(`no scale for axis "${axisId}"`);
      return scale;
    };

    return {
      width,
      height: resolvedHeight,
      margins,
      orientation,
      visibleAxes,
      axisPos,
      scaleOf,
      project: (axisId, value) => {
        const v = scaleOf(axisId).y(value);
        if (v === null) return null;
        const a = axisPos(axisId);
        return orientation === "vertical" ? { x: v, y: a } : { x: a, y: v };
      },
      valueExtent: () => valueRange,
      axisExtent: () => axisRange,
      valueCoord: (localX, localY) => (orientation === "vertical" ? localX : localY),
      axisCoord: (localX, localY) => (orientation === "vertical" ? localY : localX),
    };
  }, [axes, width, height, margins, orientation, spacing]);

  return (
    <div
      ref={containerRef}
      className={`np-chart np-layout-${orientation}${className ? ` ${className}` : ""}`}
      data-testid="np-chart"
      style={{
        position: "relative",
        width: "100%",
        height: layout ? layout.height : orientation === "vertical" ? undefined : height,
        ...style,
      }}
    >
      {layout && (
        <ChartLayoutContext.Provider value={layout}>
          <ChartLayers />
        </ChartLayoutContext.Provider>
      )}
    </div>
  );
}
