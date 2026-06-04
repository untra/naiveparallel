import { describe, expect, it } from "vitest";
import { deriveConfig } from "../data/deriveConfig";
import type { OrdinalFilter } from "../types";
import { initialParallelState, parallelReducer, type ParallelState } from "./reducer";

const data = [
  { id: 1, hp: 45, type1: "Grass" },
  { id: 2, hp: 78, type1: "Fire" },
  { id: 3, hp: 130, type1: "Water" },
];

const freshState = (): ParallelState => initialParallelState(deriveConfig(data));

describe("parallelReducer", () => {
  it("sets and clears numeric filters", () => {
    let state = freshState();
    state = parallelReducer(state, {
      type: "SET_FILTER",
      axisId: "hp",
      filter: { kind: "numeric", min: 50, max: 100 },
    });
    expect(state.filters.hp).toEqual({ kind: "numeric", min: 50, max: 100 });

    state = parallelReducer(state, { type: "SET_FILTER", axisId: "hp", filter: undefined });
    expect(state.filters.hp).toBeUndefined();
  });

  it("stores a partial ordinal filter as-is", () => {
    let state = freshState();
    state = parallelReducer(state, {
      type: "SET_FILTER",
      axisId: "type1",
      filter: { kind: "ordinal", enabled: new Set(["Grass", "Water"]) },
    });
    const filter = state.filters.type1 as OrdinalFilter;
    expect(filter.kind).toBe("ordinal");
    expect(filter.enabled).toEqual(new Set(["Grass", "Water"]));
  });

  it("deletes an ordinal filter that enables every value", () => {
    let state = freshState();
    state = parallelReducer(state, {
      type: "SET_FILTER",
      axisId: "type1",
      filter: { kind: "ordinal", enabled: new Set(["Fire", "Grass", "Water"]) },
    });
    expect(state.filters.type1).toBeUndefined();
  });

  it("unhides an existing axis on ADD_AXIS", () => {
    let state = freshState();
    state = parallelReducer(state, { type: "SET_HIDDEN", axisId: "type1", hidden: true });
    expect(state.config.axes.find((a) => a.id === "type1")?.hidden).toBe(true);
    const axis = state.config.axes.find((a) => a.id === "type1")!;
    state = parallelReducer(state, { type: "ADD_AXIS", axis });
    expect(state.config.axes.find((a) => a.id === "type1")?.hidden).toBe(false);
  });

  it("removes an axis along with its filter and selection", () => {
    let state = freshState();
    state = parallelReducer(state, { type: "SELECT_AXIS", axisId: "hp" });
    state = parallelReducer(state, {
      type: "SET_FILTER",
      axisId: "hp",
      filter: { kind: "numeric", min: 0, max: 100 },
    });
    state = parallelReducer(state, { type: "REMOVE_AXIS", axisId: "hp" });
    expect(state.config.axes.find((a) => a.id === "hp")).toBeUndefined();
    expect(state.filters.hp).toBeUndefined();
    expect(state.config.selectedAxisId).toBeNull();
  });

  it("reorders axes by the given id order, unknown ids last", () => {
    let state = freshState();
    state = parallelReducer(state, { type: "REORDER", orderedIds: ["type1", "hp"] });
    expect(state.config.axes.map((a) => a.id)).toEqual(["type1", "hp", "id"]);
  });

  it("locks colorizing to an axis", () => {
    let state = freshState();
    state = parallelReducer(state, { type: "SET_COLORIZE", axisId: "type1", mode: "locked" });
    expect(state.config.colorizeAxisId).toBe("type1");
    expect(state.config.colorizeMode).toBe("locked");
  });

  it("resets to a fresh config, clearing filters", () => {
    let state = freshState();
    state = parallelReducer(state, {
      type: "SET_FILTER",
      axisId: "hp",
      filter: { kind: "numeric", min: 0, max: 1 },
    });
    const next = deriveConfig(data.slice(0, 2));
    state = parallelReducer(state, { type: "RESET", config: next });
    expect(state.config).toBe(next);
    expect(state.filters).toEqual({});
  });
});
