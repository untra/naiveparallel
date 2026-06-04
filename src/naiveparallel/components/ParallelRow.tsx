import React from "react";
import { useNaiveParallel, useNaiveParallelInteraction } from "../context/NaiveParallelContext";
import type { ColumnStats, DataObj, ParallelAxis } from "../types";

/** Everything a ParallelRow render-prop receives. */
export interface ParallelRowContext<T extends DataObj = DataObj> {
  /** The row under the pointer on the chart (nearest polyline). */
  hoveredRow: T | null;
  /** The row pinned by clicking the chart. */
  selectedRow: T | null;
  /** The rows currently passing every filter. */
  filteredData: T[];
  axes: ParallelAxis[];
  selectedAxis: ParallelAxis | null;
  /** Live stats of the selected axis over the filtered rows. */
  stats: ColumnStats | null;
  setSelected: (row: T | null) => void;
}

export interface ParallelRowProps<T extends DataObj = DataObj> {
  /**
   * Pure render-prop
   */
  children?: (context: ParallelRowContext<T>) => React.ReactNode;
}

/**
 * Exposes the chart's contextual row state (hover, selection, filtered set,
 * stats) for free-form downstream rendering. Carries no UI of its own.
 */
export function ParallelRow<T extends DataObj = DataObj>(props: ParallelRowProps<T>) {
  const { filteredData, axes, selectedAxis, selectedStats } = useNaiveParallel<T>();
  const { hoveredRow, selectedRow, setSelected } = useNaiveParallelInteraction<T>();

  if (!props.children) return null;
  return (
    <>
      {props.children({
        hoveredRow,
        selectedRow,
        filteredData,
        axes,
        selectedAxis,
        stats: selectedStats,
        setSelected,
      })}
    </>
  );
}
