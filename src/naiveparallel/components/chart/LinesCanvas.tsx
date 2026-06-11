import { useEffect, useMemo, useRef } from "react";
import { useNaiveParallel } from "../../context/NaiveParallelContext";
import { axisValue } from "../../data/accessors";
import { muteColor } from "../../data/colorize";
import type { DataObj } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

/** Opacity of rows passing the filters. */
const ACTIVE_ALPHA = 0.5;
/**
 * Opacity of filtered-out (muted) rows. Muting cannot rely on alpha alone:
 * n overlapping strokes composite to 1-(1-alpha)^n, so a dense pile of
 * excluded rows would converge back to the vivid row color. Muted strokes
 * therefore also draw in muteColor() pale tints — the convergence limit.
 */
const MUTED_ALPHA = 0.08;

function drawRow(
  ctx: CanvasRenderingContext2D,
  row: DataObj,
  layout: ReturnType<typeof useChartLayout>
) {
  ctx.beginPath();
  let penDown = false;
  for (const axis of layout.visibleAxes) {
    const y = layout.scaleOf(axis.id).y(axisValue(axis, row));
    if (y === null) {
      penDown = false; // break the line across missing values
      continue;
    }
    const x = layout.xOf(axis.id);
    if (penDown) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    penDown = true;
  }
  ctx.stroke();
}

/**
 * The canvas layer underneath the SVG: one polyline per row, colorized by the
 * context's colorOf; filtered-out rows draw as low-alpha pale tints. Redraws
 * when a filter / axis / colorize change commits — never mid-gesture.
 */
export function LinesCanvas() {
  const { data, filteredData, colorOf } = useNaiveParallel();
  const layout = useChartLayout();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const passing = useMemo(() => new Set<DataObj>(filteredData), [filteredData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = typeof window !== "undefined" ? (window.devicePixelRatio ?? 1) : 1;
    canvas.width = Math.round(layout.width * dpr);
    canvas.height = Math.round(layout.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // logical coordinates equal to SVG

    ctx.clearRect(0, 0, layout.width, layout.height);
    if (layout.visibleAxes.length === 0) return;

    ctx.lineWidth = 1;
    // muted rows first so active rows draw over them
    ctx.globalAlpha = MUTED_ALPHA;
    for (const row of data) {
      if (passing.has(row)) continue;
      ctx.strokeStyle = muteColor(colorOf(row));
      drawRow(ctx, row, layout);
    }
    ctx.globalAlpha = ACTIVE_ALPHA;
    for (const row of filteredData) {
      ctx.strokeStyle = colorOf(row);
      drawRow(ctx, row, layout);
    }
  }, [data, filteredData, passing, colorOf, layout]);

  return (
    <canvas
      ref={canvasRef}
      className="np-lines"
      data-testid="np-lines-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: layout.width,
        height: layout.height,
      }}
    />
  );
}
