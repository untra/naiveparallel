import { describe, expect, it } from "vitest";
import type { NumericalAxis, OrdinalAxis } from "../types";
import { columnStats, numericalStats, ordinalStats } from "./stats";

describe("numericalStats", () => {
  it("computes the six stats over known values", () => {
    // values: 2, 4, 4, 4, 5, 5, 7, 9 — classic σ example
    const stats = numericalStats([2, 4, 4, 4, 5, 5, 7, 9])!;
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    expect(stats.mean).toBe(5);
    expect(stats.median).toBe(4.5);
    expect(stats.q1).toBe(4);
    expect(stats.q3).toBe(5.5);
    expect(stats.stddev).toBeCloseTo(2.138, 3); // sample stddev
    expect(stats.count).toBe(8);
  });

  it("handles a single value", () => {
    const stats = numericalStats([42])!;
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.mean).toBe(42);
    expect(stats.median).toBe(42);
    expect(stats.stddev).toBe(0);
  });

  it("returns null for no values", () => {
    expect(numericalStats([])).toBeNull();
  });
});

describe("ordinalStats", () => {
  const ordering = ["low", "mid", "high"];

  it("finds the mode", () => {
    const stats = ordinalStats(["mid", "low", "mid", "high", "mid"], ordering)!;
    expect(stats.mode).toBe("mid");
    expect(stats.counts).toEqual({ low: 1, mid: 3, high: 1 });
  });

  it("finds the median along the axis ordering", () => {
    const stats = ordinalStats(["high", "low", "mid"], ordering)!;
    expect(stats.median).toBe("mid");
  });

  it("computes zero dispersion for a single category", () => {
    expect(ordinalStats(["low", "low"], ordering)!.dispersion).toBe(0);
  });

  it("computes maximal dispersion (1) for a uniform distribution", () => {
    const stats = ordinalStats(["low", "mid", "high"], ordering)!;
    expect(stats.dispersion).toBeCloseTo(1, 10);
  });

  it("returns null for no values", () => {
    expect(ordinalStats([], ordering)).toBeNull();
  });
});

describe("columnStats", () => {
  const rows = [
    { stats: { hp: 10 }, type: "a" },
    { stats: { hp: 20 }, type: "b" },
    { stats: { hp: "bad" }, type: 3 },
  ];

  it("collects numerical values through the axis path, skipping mistyped rows", () => {
    const axis: NumericalAxis = {
      id: "stats.hp",
      path: "stats.hp",
      label: "hp",
      hidden: false,
      kind: "numerical",
      domain: [0, 255],
      allIntegers: true,
      allPositive: true,
    };
    const stats = columnStats(axis, rows)!;
    expect(stats.kind).toBe("numerical");
    expect(stats.count).toBe(2);
  });

  it("collects ordinal values through the axis mapping", () => {
    const axis: OrdinalAxis = {
      id: "type",
      path: "type",
      label: "type",
      hidden: false,
      kind: "ordinal",
      values: ["a", "b", "3"],
      cardinality: 3,
      colors: {},
      source: "string",
      renderable: true,
    };
    const stats = columnStats(axis, rows)!;
    expect(stats.kind).toBe("ordinal");
    expect(stats.count).toBe(3); // the number 3 coerces to the ordinal "3"
  });
});
