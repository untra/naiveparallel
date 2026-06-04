import { useEffect, useRef } from "react";
import { useNaiveParallel, useNaiveParallelInteraction } from "../../context/NaiveParallelContext";
import { axisValue } from "../../data/accessors";
import type { DataObj } from "../../types";
import { useChartLayout, type ChartLayout } from "./ChartLayoutContext";

function drawRow(ctx: CanvasRenderingContext2D, row: DataObj, layout: ChartLayout) {
  ctx.beginPath();
  let penDown = false;
  for (const axis of layout.visibleAxes) {
    const y = layout.scaleOf(axis.id).y(axisValue(axis, row));
    if (y === null) {
      penDown = false;
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
 * A second, tiny canvas that draws only the hovered and selected rows at
 * full opacity. Hover state re-renders this layer alone — the main
 * LinesCanvas and every data-context consumer stay untouched.
 */
export function HoverCanvas() {
  const { colorOf } = useNaiveParallel();
  const { hoveredRow, selectedRow } = useNaiveParallelInteraction();
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

    if (selectedRow) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colorOf(selectedRow);
      drawRow(ctx, selectedRow, layout);
    }
    if (hoveredRow && hoveredRow !== selectedRow) {
      ctx.globalAlpha = 0.95;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = colorOf(hoveredRow);
      drawRow(ctx, hoveredRow, layout);
    }
  }, [hoveredRow, selectedRow, colorOf, layout]);

  return (
    <canvas
      ref={canvasRef}
      className="np-hover"
      data-testid="np-hover-canvas"
      style={{ position: "absolute", inset: 0, width: layout.width, height: layout.height, pointerEvents: "none" }}
    />
  );
}
