import React from "react";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import type { ColumnStats, ParallelAxis } from "../types";
import { STAT_COLORS } from "../types";

export interface ParallelColumnProps {
  /**
   * Render-prop receiving the selected axis and its live stats over the
   * filtered data; omit it for the default labeled readout.
   */
  children?: (stats: ColumnStats | null, axis: ParallelAxis | null) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const dot = (color: string): React.CSSProperties => ({
  display: "inline-block",
  width: 10,
  height: 10,
  marginRight: 6,
  borderRadius: 2,
  background: color,
});

/**
 * Reports the selected column's statistics, recomputed live as brushes and
 * toggles change. Numerical axes report the six color-coded stats; ordinal
 * axes report mode, median, and dispersion index.
 */
export function ParallelColumn(props: ParallelColumnProps) {
  const { selectedAxis, selectedStats, filteredData, data } = useNaiveParallel();

  if (props.children) return <>{props.children(selectedStats, selectedAxis)}</>;

  if (!selectedAxis) {
    return (
      <div className={`np-column${props.className ? ` ${props.className}` : ""}`} style={props.style}>
        <em className="np-column-empty">no axis selected</em>
      </div>
    );
  }

  return (
    <div
      className={`np-column${props.className ? ` ${props.className}` : ""}`}
      data-testid="np-column"
      style={props.style}
    >
      <strong className="np-column-title">{selectedAxis.label}</strong>{" "}
      <span className="np-column-count">
        {filteredData.length} / {data.length} rows
      </span>
      {selectedStats?.kind === "numerical" && (
        <dl className="np-column-stats">
          <div><dt><i style={dot(STAT_COLORS.max)} />max</dt><dd>{format(selectedStats.max)}</dd></div>
          <div><dt><i style={dot(STAT_COLORS.mean)} />mean</dt><dd>{format(selectedStats.mean)}</dd></div>
          <div><dt><i style={dot(STAT_COLORS.median)} />median</dt><dd>{format(selectedStats.median)}</dd></div>
          <div><dt><i style={dot(STAT_COLORS.stddev)} />±1σ</dt><dd>{format(selectedStats.stddev)}</dd></div>
          <div><dt><i style={dot(STAT_COLORS.iqr)} />IQR</dt><dd>{format(selectedStats.q1)} – {format(selectedStats.q3)}</dd></div>
          <div><dt><i style={dot(STAT_COLORS.min)} />min</dt><dd>{format(selectedStats.min)}</dd></div>
        </dl>
      )}
      {selectedStats?.kind === "ordinal" && (
        <dl className="np-column-stats">
          <div><dt>mode</dt><dd>{selectedStats.mode}</dd></div>
          <div><dt>median</dt><dd>{selectedStats.median ?? "—"}</dd></div>
          <div><dt>dispersion</dt><dd>{selectedStats.dispersion.toFixed(3)}</dd></div>
        </dl>
      )}
      {!selectedStats && <em className="np-column-empty">no data in range</em>}
    </div>
  );
}

function format(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
