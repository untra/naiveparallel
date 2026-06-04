import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { collectValues } from "../data/accessors";
import { buildColorizer, resolveColorizeAxis } from "../data/colorize";
import { applyFilters } from "../data/filter";
import { inferAxis } from "../data/inferAxes";
import { columnStats } from "../data/stats";
import type {
  AxisFilter,
  ColorizeMode,
  DataObj,
  NaiveParallelConfig,
  NaiveParallelData,
  NaiveParallelInteraction,
  Path,
} from "../types";
import { MAX_ORDINAL } from "../types";
import { NaiveParallelDataContext, NaiveParallelInteractionContext } from "./NaiveParallelContext";
import { initialParallelState, parallelReducer } from "./reducer";

export interface NaiveParallelProviderProps<T extends DataObj> {
  /** Null-filtered rows (NaiveParallel strips null/undefined entries). */
  data: T[];
  /** The resolved (provided or derived) configuration. */
  config: NaiveParallelConfig;
  children?: React.ReactNode;
}

/**
 * Holds all NaiveParallel state: the axis/filter/selection reducer plus the
 * derived filtered rows, stats, and colorizer — memoized so the value only
 * changes when something commits. Interaction (hover/selection) lives in its
 * own context to isolate high-frequency re-renders.
 */
export function NaiveParallelProvider<T extends DataObj>(props: NaiveParallelProviderProps<T>) {
  const { data, config, children } = props;
  const [state, dispatch] = useReducer(parallelReducer, config, initialParallelState);

  // reinitialize (clearing filters) when the data-derived config changes
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    dispatch({ type: "RESET", config });
  }, [config]);

  const { axes } = state.config;

  const filteredData = useMemo(
    () => applyFilters(data, axes, state.filters),
    [data, axes, state.filters]
  );

  const selectedAxis = useMemo(
    () => axes.find((a) => a.id === state.config.selectedAxisId) ?? null,
    [axes, state.config.selectedAxisId]
  );

  const selectedStats = useMemo(
    () => (selectedAxis ? columnStats(selectedAxis, filteredData) : null),
    [selectedAxis, filteredData]
  );

  const colorizeAxis = useMemo(() => resolveColorizeAxis(state.config), [state.config]);

  const colorOf = useMemo(() => buildColorizer(colorizeAxis), [colorizeAxis]);

  const setFilter = useCallback(
    (axisId: string, filter: AxisFilter | undefined) => dispatch({ type: "SET_FILTER", axisId, filter }),
    []
  );
  const addAxis = useCallback(
    (path: Path) => {
      const axis = inferAxis({ path, values: collectValues(data, path), maxOrdinal: MAX_ORDINAL });
      if (axis) dispatch({ type: "ADD_AXIS", axis });
    },
    [data]
  );
  const removeAxis = useCallback((axisId: string) => dispatch({ type: "REMOVE_AXIS", axisId }), []);
  const setAxisHidden = useCallback(
    (axisId: string, hidden: boolean) => dispatch({ type: "SET_HIDDEN", axisId, hidden }),
    []
  );
  const reorderAxes = useCallback(
    (orderedIds: string[]) => dispatch({ type: "REORDER", orderedIds }),
    []
  );
  const selectAxis = useCallback(
    (axisId: string | null) => dispatch({ type: "SELECT_AXIS", axisId }),
    []
  );
  const setColorize = useCallback(
    (axisId: string | null, mode: ColorizeMode) => dispatch({ type: "SET_COLORIZE", axisId, mode }),
    []
  );

  const value = useMemo<NaiveParallelData>(
    () => ({
      data,
      axes,
      config: state.config,
      filters: state.filters,
      filteredData,
      selectedAxis,
      selectedStats,
      colorizeAxis,
      colorOf: colorOf as (row: DataObj) => string,
      setFilter,
      addAxis,
      removeAxis,
      setAxisHidden,
      reorderAxes,
      selectAxis,
      setColorize,
    }),
    [
      data,
      axes,
      state.config,
      state.filters,
      filteredData,
      selectedAxis,
      selectedStats,
      colorizeAxis,
      colorOf,
      setFilter,
      addAxis,
      removeAxis,
      setAxisHidden,
      reorderAxes,
      selectAxis,
      setColorize,
    ]
  );

  const [hoveredRow, setHovered] = useState<DataObj | null>(null);
  const [selectedRow, setSelected] = useState<DataObj | null>(null);
  const interaction = useMemo<NaiveParallelInteraction>(
    () => ({ hoveredRow, selectedRow, setHovered, setSelected }),
    [hoveredRow, selectedRow]
  );

  return (
    <NaiveParallelDataContext.Provider value={value}>
      <NaiveParallelInteractionContext.Provider value={interaction}>
        {children}
      </NaiveParallelInteractionContext.Provider>
    </NaiveParallelDataContext.Provider>
  );
}
