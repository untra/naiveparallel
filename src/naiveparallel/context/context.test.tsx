import { act, render, renderHook, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import { deriveConfig } from "../data/deriveConfig";
import type { DataObj, NumericalStats } from "../types";
import { useNaiveParallel, useNaiveParallelInteraction } from "./NaiveParallelContext";
import { NaiveParallelProvider } from "./NaiveParallelProvider";

const data = [
  { id: 1, hp: 45, type1: "Grass" },
  { id: 2, hp: 78, type1: "Fire" },
  { id: 3, hp: 130, type1: "Water" },
];

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NaiveParallelProvider data={data} config={deriveConfig(data)}>
      {children}
    </NaiveParallelProvider>
  );
}

describe("useNaiveParallel", () => {
  it("throws outside the provider", () => {
    expect(() => renderHook(() => useNaiveParallel())).toThrow(/within a <NaiveParallel>/);
    expect(() => renderHook(() => useNaiveParallelInteraction())).toThrow(
      /within a <NaiveParallel>/
    );
  });

  it("provides data, axes, and config", () => {
    const { result } = renderHook(() => useNaiveParallel(), { wrapper });
    expect(result.current.data).toHaveLength(3);
    expect(result.current.axes.map((a) => a.id)).toEqual(["id", "hp", "type1"]);
    expect(result.current.config.selectedAxisId).toBe("id");
    expect(result.current.filteredData).toHaveLength(3);
  });

  it("updates filteredData and stats when a filter commits", () => {
    const { result } = renderHook(() => useNaiveParallel(), { wrapper });
    act(() => {
      result.current.selectAxis("hp");
    });
    act(() => {
      result.current.setFilter("hp", { kind: "numeric", min: 50, max: 200 });
    });
    expect(result.current.filteredData.map((r) => r.id)).toEqual([2, 3]);
    const stats = result.current.selectedStats as NumericalStats;
    expect(stats.kind).toBe("numerical");
    expect(stats.count).toBe(2);
    expect(stats.min).toBe(78);
    expect(stats.max).toBe(130);
  });

  it("toggles ordinal values through the context", () => {
    const { result } = renderHook(() => useNaiveParallel(), { wrapper });
    act(() => {
      result.current.toggleOrdinalValue("type1", "Grass");
    });
    expect(result.current.filteredData.map((r) => r.id)).toEqual([2, 3]);
  });

  it("adds a new axis inferred from a data path", () => {
    const { result } = renderHook(() => useNaiveParallel(), { wrapper });
    act(() => {
      result.current.removeAxis("type1");
    });
    expect(result.current.axes.find((a) => a.id === "type1")).toBeUndefined();
    act(() => {
      result.current.addAxis("type1");
    });
    expect(result.current.axes.find((a) => a.id === "type1")?.kind).toBe("ordinal");
  });

  it("colorizes rows by the followed selected axis", () => {
    const { result } = renderHook(() => useNaiveParallel(), { wrapper });
    expect(result.current.colorizeAxis?.id).toBe("id");
    act(() => {
      result.current.selectAxis("hp");
    });
    expect(result.current.colorizeAxis?.id).toBe("hp");
    act(() => {
      result.current.setColorize("type1", "locked");
    });
    expect(result.current.colorizeAxis?.id).toBe("type1");
    expect(typeof result.current.colorOf(data[0])).toBe("string");
  });
});

describe("interaction context", () => {
  it("tracks hovered and selected rows independently of the data context", () => {
    const { result } = renderHook(
      () => ({
        interaction: useNaiveParallelInteraction(),
        parallel: useNaiveParallel(),
      }),
      { wrapper }
    );
    const before = result.current.parallel;
    act(() => {
      result.current.interaction.setHovered(data[1]);
      result.current.interaction.setSelected(data[2]);
    });
    expect(result.current.interaction.hoveredRow).toBe(data[1]);
    expect(result.current.interaction.selectedRow).toBe(data[2]);
    // the data context value is untouched by hover state
    expect(result.current.parallel).toBe(before);
  });
});

describe("provider reset", () => {
  it("reinitializes when the config prop changes", () => {
    function Probe() {
      const { axes, filters } = useNaiveParallel();
      return (
        <div>
          <span data-testid="axes">{axes.map((a) => a.id).join(",")}</span>
          <span data-testid="filters">{Object.keys(filters).length}</span>
        </div>
      );
    }
    function Host({ rows }: { rows: DataObj[] }) {
      const config = React.useMemo(() => deriveConfig(rows), [rows]);
      return (
        <NaiveParallelProvider data={rows} config={config}>
          <Probe />
        </NaiveParallelProvider>
      );
    }
    const { rerender } = render(<Host rows={data} />);
    expect(screen.getByTestId("axes").textContent).toBe("id,hp,type1");
    rerender(<Host rows={[{ id: 1, speed: 10 }]} />);
    expect(screen.getByTestId("axes").textContent).toBe("id,speed");
  });
});
