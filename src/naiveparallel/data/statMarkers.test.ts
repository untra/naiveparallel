import { describe, expect, it } from "vitest";
import { STAT_COLORS, type StatMarkersConfig } from "../types";
import { statColor, statShown } from "./statMarkers";

describe("statShown", () => {
  it("shows every stat when no config is given", () => {
    for (const key of ["max", "min", "median", "mean", "mode", "iqr", "stddev", "dispersion"] as const) {
      expect(statShown(undefined, key)).toBe(true);
    }
  });

  it("hides all stats when enabled is false", () => {
    const cfg: StatMarkersConfig = { enabled: false };
    expect(statShown(cfg, "max")).toBe(false);
    expect(statShown(cfg, "median")).toBe(false);
    expect(statShown(cfg, "dispersion")).toBe(false);
  });

  it("hides only the stats set to false", () => {
    const cfg: StatMarkersConfig = { colors: { mean: false, stddev: false } };
    expect(statShown(cfg, "mean")).toBe(false);
    expect(statShown(cfg, "stddev")).toBe(false);
    expect(statShown(cfg, "max")).toBe(true);
    expect(statShown(cfg, "median")).toBe(true);
  });

  it("treats enabled:true with a custom color as shown", () => {
    const cfg: StatMarkersConfig = { enabled: true, colors: { max: "#e0245e" } };
    expect(statShown(cfg, "max")).toBe(true);
  });
});

describe("statColor", () => {
  it("falls back to STAT_COLORS when unset", () => {
    expect(statColor(undefined, "max")).toBe(STAT_COLORS.max);
    expect(statColor(undefined, "iqr")).toBe(STAT_COLORS.iqr);
    expect(statColor({}, "median")).toBe(STAT_COLORS.median);
  });

  it("returns the override string for a recolored stat", () => {
    const cfg: StatMarkersConfig = { colors: { max: "#e0245e" } };
    expect(statColor(cfg, "max")).toBe("#e0245e");
    // untouched keys keep their default
    expect(statColor(cfg, "min")).toBe(STAT_COLORS.min);
  });

  it("falls back to the default when the key is hidden (false)", () => {
    const cfg: StatMarkersConfig = { colors: { max: false } };
    expect(statColor(cfg, "max")).toBe(STAT_COLORS.max);
  });
});
