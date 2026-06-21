import React, { useEffect, useRef, useState } from "react";
import { useNaiveParallel, useNaiveParallelInteraction } from "../../../context/NaiveParallelContext";
import { axisValue, pathAccessor } from "../../../data/accessors";
import { formatTemporal } from "../../../data/temporal";
import type { DataObj, ParallelAxis } from "../../../types";
import { useChartLayout } from "../ChartLayoutContext";

const WIDTH = 200;
const OFFSET = 14;

/** A row's value for an axis, formatted the way ParallelColumn formats stats. */
function formatValue(axis: ParallelAxis, row: DataObj): string {
  const v = axisValue(axis, row);
  if (v === null) return "—";
  if (typeof v === "string") return v;
  if (axis.kind === "temporal") return formatTemporal(v);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

/**
 * The identity value for the tooltip title: the row's raw cell at the axis'
 * path, so an ordinal mapping (e.g. the first-char reducer) is bypassed and the
 * full, unmapped string shows. Temporal axes still format as a date.
 */
export function formatIdentity(axis: ParallelAxis, row: DataObj): string {
  const raw = pathAccessor(axis.path)(row);
  if (raw == null) return "—";
  if (axis.kind === "temporal") {
    const v = axisValue(axis, row);
    if (typeof v === "number") return formatTemporal(v);
  }
  if (typeof raw === "number") return Number.isInteger(raw) ? String(raw) : raw.toFixed(2);
  return String(raw);
}

const notThisAxis = (thisAxis: ParallelAxis) => (axis: ParallelAxis) => axis.label !== thisAxis.label

/**
 * Teaches "rows are records": on hover, a tooltip naming the row (its identity /
 * first-axis value) plus its per-axis values follows the pointer, clamped within
 * the chart. Reads only the interaction context, so it never re-renders data
 * consumers. Disabled in vertical (mobile) layout, where space is tight and the
 * pointer occlusion risk is higher — hover still thickens the line there.
 */
export function HoverTooltip({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const layout = useChartLayout();
  const { axes } = useNaiveParallel();
  const { hoveredRow } = useNaiveParallelInteraction();
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  // track the pointer locally (rAF-throttled) off a native listener, so moving
  // the mouse re-renders only this tooltip — not the canvases or data consumers
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const onMove = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setPos({ x, y });
      });
    };
    node.addEventListener("pointermove", onMove);
    return () => {
      node.removeEventListener("pointermove", onMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [containerRef]);

  if (layout.orientation !== "horizontal") return null;
  if (!hoveredRow || !pos) return null;

  const idAxis = axes[0] ?? null;
  let left = pos.x + OFFSET;
  if (left + WIDTH > layout.width) left = Math.max(0, pos.x - WIDTH - OFFSET);
  let top = pos.y + OFFSET;
  top = Math.max(0, Math.min(top, layout.height - 24));

  return (
    <div
      className="np-hint-tooltip"
      data-testid="np-hint-tooltip"
      style={{ position: "absolute", pointerEvents: "none", left, top, maxWidth: WIDTH }}
    >
      {idAxis && (
        <div className="np-hint-tooltip-title">
          {idAxis.label}: {formatIdentity(idAxis, hoveredRow)}
        </div>
      )}
      <dl className="np-hint-tooltip-rows">
        {layout.visibleAxes.filter(notThisAxis(idAxis)).map((a) => (
          <div key={a.id}>
            <dt>{a.label}</dt>
            <dd>{formatValue(a, hoveredRow)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
