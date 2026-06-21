import { useEffect, useRef } from "react";
import { useNaiveParallel } from "../../../context/NaiveParallelContext";
import { axisValue } from "../../../data/accessors";
import type { DataObj, ParallelAxis } from "../../../types";
import { useChartLayout, type ChartLayout } from "../ChartLayoutContext";

/** Opacity of the kept (in-range) rows — same as a real passing row, just crisp. */
const KEPT_ALPHA = 0.75;

function drawRow(ctx: CanvasRenderingContext2D, row: DataObj, layout: ChartLayout) {
  ctx.beginPath();
  let penDown = false;
  for (const axis of layout.visibleAxes) {
    const p = layout.project(axis.id, axisValue(axis, row));
    if (p === null) {
      penDown = false;
      continue;
    }
    if (penDown) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
    penDown = true;
  }
  ctx.stroke();
}

/**
 * Previews what brushing actually does: while the ghost brush is on screen the
 * main LinesCanvas dims (the `.np-hint-demo` class, applied by GhostBrush —
 * standing in for filtered-*out* rows), and this canvas redraws the rows whose
 * value on the active axis falls inside the brush range at their normal kept
 * appearance, so they stay vivid as the rows that pass the filter. The kept band
 * grows with the demo brush extent. Drawn on its own dpr-scaled canvas; never
 * intercepts pointer events and never touches data state.
 */
export function GhostHighlightCanvas({ axis, fraction }: { axis: ParallelAxis; fraction: number }) {
  const { data, colorOf } = useNaiveParallel();
  const layout = useChartLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
    canvas.width = Math.round(layout.width * dpr);
    canvas.height = Math.round(layout.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.width, layout.height);

    const f = Math.max(0, Math.min(1, fraction));
    if (f <= 0 || layout.visibleAxes.length === 0) return;

    // the value-direction pixel band the demo brush currently covers
    const [lo, hi] = layout.valueExtent();
    const center = (lo + hi) / 2;
    const half = (Math.abs(hi - lo) * f) / 2;
    const bandLo = center - half;
    const bandHi = center + half;
    const scale = layout.scaleOf(axis.id);

    const inRange: DataObj[] = [];
    for (const row of data) {
      const v = scale.y(axisValue(axis, row));
      if (v !== null && v >= bandLo && v <= bandHi) inRange.push(row);
    }
    if (inRange.length === 0) return;

    // the kept rows in their normal color, staying vivid while the crowd dims
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = KEPT_ALPHA;
    for (const row of inRange) {
      ctx.strokeStyle = colorOf(row);
      drawRow(ctx, row, layout);
    }
  }, [data, colorOf, layout, axis, fraction]);

  return (
    <canvas
      ref={canvasRef}
      className="np-hint-ghost-highlight"
      data-testid="np-hint-ghost-highlight"
      style={{
        position: "absolute",
        inset: 0,
        width: layout.width,
        height: layout.height,
        pointerEvents: "none",
      }}
    />
  );
}
