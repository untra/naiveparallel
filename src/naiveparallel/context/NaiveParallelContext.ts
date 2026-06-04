import { createContext, useContext } from "react";
import type { DataObj, NaiveParallelData, NaiveParallelInteraction } from "../types";

export const NaiveParallelDataContext = createContext<NaiveParallelData | null>(null);
export const NaiveParallelInteractionContext = createContext<NaiveParallelInteraction | null>(null);

/**
 * Reads the NaiveParallel data context: the data, axes, filters, filtered
 * rows, selected-column stats, colorizer, and all commit-time updaters.
 * Must be used within a <NaiveParallel>.
 */
export function useNaiveParallel<T extends DataObj = DataObj>(): NaiveParallelData<T> {
  const context = useContext(NaiveParallelDataContext);
  if (context === null) {
    throw new Error("useNaiveParallel must be used within a <NaiveParallel> component");
  }
  return context as unknown as NaiveParallelData<T>;
}

/**
 * Reads the NaiveParallel interaction context: hovered / selected rows and
 * their setters. Kept separate from the data context so hover-driven
 * re-renders stay isolated. Must be used within a <NaiveParallel>.
 */
export function useNaiveParallelInteraction<T extends DataObj = DataObj>(): NaiveParallelInteraction<T> {
  const context = useContext(NaiveParallelInteractionContext);
  if (context === null) {
    throw new Error("useNaiveParallelInteraction must be used within a <NaiveParallel> component");
  }
  return context as unknown as NaiveParallelInteraction<T>;
}
