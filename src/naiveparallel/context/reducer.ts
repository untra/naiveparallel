import type {
  AxisFilter,
  ColorizeMode,
  FilterState,
  NaiveParallelConfig,
  ParallelAxis,
} from "../types";

export interface ParallelState {
  config: NaiveParallelConfig;
  filters: FilterState;
}

export type ParallelAction =
  | { type: "RESET"; config: NaiveParallelConfig }
  | { type: "SET_FILTER"; axisId: string; filter: AxisFilter | undefined }
  | { type: "ADD_AXIS"; axis: ParallelAxis }
  | { type: "REMOVE_AXIS"; axisId: string }
  | { type: "SET_HIDDEN"; axisId: string; hidden: boolean }
  | { type: "REORDER"; orderedIds: string[] }
  | { type: "SELECT_AXIS"; axisId: string | null }
  | { type: "SET_COLORIZE"; axisId: string | null; mode: ColorizeMode };

export function initialParallelState(config: NaiveParallelConfig): ParallelState {
  return { config, filters: {} };
}

function updateAxis(
  config: NaiveParallelConfig,
  axisId: string,
  update: (axis: ParallelAxis) => ParallelAxis
): NaiveParallelConfig {
  return {
    ...config,
    axes: config.axes.map((axis) => (axis.id === axisId ? update(axis) : axis)),
  };
}

export function parallelReducer(state: ParallelState, action: ParallelAction): ParallelState {
  switch (action.type) {
    case "RESET":
      return initialParallelState(action.config);

    case "SET_FILTER": {
      const filters = { ...state.filters };
      const axis = state.config.axes.find((a) => a.id === action.axisId);
      // an ordinal filter enabling every value is no filter at all
      const allEnabled =
        action.filter?.kind === "ordinal" &&
        axis?.kind === "ordinal" &&
        action.filter.enabled.size === axis.values.length;
      if (action.filter === undefined || allEnabled) delete filters[action.axisId];
      else filters[action.axisId] = action.filter;
      return { ...state, filters };
    }

    case "ADD_AXIS": {
      const existing = state.config.axes.find((a) => a.id === action.axis.id);
      if (existing) {
        return { ...state, config: updateAxis(state.config, existing.id, (a) => ({ ...a, hidden: false })) };
      }
      return { ...state, config: { ...state.config, axes: [...state.config.axes, action.axis] } };
    }

    case "REMOVE_AXIS": {
      const axes = state.config.axes.filter((a) => a.id !== action.axisId);
      const filters = { ...state.filters };
      delete filters[action.axisId];
      return {
        config: {
          ...state.config,
          axes,
          selectedAxisId:
            state.config.selectedAxisId === action.axisId ? null : state.config.selectedAxisId,
          colorizeAxisId:
            state.config.colorizeAxisId === action.axisId ? null : state.config.colorizeAxisId,
        },
        filters,
      };
    }

    case "SET_HIDDEN":
      return {
        ...state,
        config: updateAxis(state.config, action.axisId, (a) => ({ ...a, hidden: action.hidden })),
      };

    case "REORDER": {
      const rank = new Map(action.orderedIds.map((id, i) => [id, i]));
      const axes = [...state.config.axes].sort(
        (a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity)
      );
      return { ...state, config: { ...state.config, axes } };
    }

    case "SELECT_AXIS":
      return { ...state, config: { ...state.config, selectedAxisId: action.axisId } };

    case "SET_COLORIZE":
      return {
        ...state,
        config: { ...state.config, colorizeAxisId: action.axisId, colorizeMode: action.mode },
      };
  }
}
