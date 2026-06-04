import { describe, expect, it } from "vitest";
import mons from "../../demo/data/mons.json";
import type { NumericalAxis, OrdinalAxis } from "../types";
import { buildColorizer, FALLBACK_COLOR, resolveColorizeAxis } from "./colorize";
import { deriveConfig } from "./deriveConfig";

const hpAxis: NumericalAxis = {
  id: "hp",
  path: "hp",
  label: "hp",
  hidden: false,
  kind: "numerical",
  domain: [0, 100],
  allIntegers: true,
  allPositive: true,
};

const typeAxis: OrdinalAxis = {
  id: "type1",
  path: "type1",
  label: "type1",
  hidden: false,
  kind: "ordinal",
  values: ["Fire", "Water"],
  cardinality: 2,
  colors: { Fire: "#EE8130", Water: "#6390F0" },
  source: "string",
  renderable: true,
};

describe("buildColorizer", () => {
  it("ramps numerical values from blue (low) to red (high)", () => {
    const colorize = buildColorizer(hpAxis);
    expect(colorize({ hp: 0 })).toBe("hsl(240, 70%, 50%)");
    expect(colorize({ hp: 100 })).toBe("hsl(0, 70%, 50%)");
    expect(colorize({ hp: 50 })).toBe("hsl(120, 70%, 50%)");
  });

  it("clamps out-of-domain values", () => {
    const colorize = buildColorizer(hpAxis);
    expect(colorize({ hp: -50 })).toBe("hsl(240, 70%, 50%)");
    expect(colorize({ hp: 500 })).toBe("hsl(0, 70%, 50%)");
  });

  it("looks ordinal values up in the axis colors", () => {
    const colorize = buildColorizer(typeAxis);
    expect(colorize({ type1: "Fire" })).toBe("#EE8130");
    expect(colorize({ type1: "Unknown" })).toBe(FALLBACK_COLOR);
  });

  it("falls back without an axis or value", () => {
    expect(buildColorizer(null)({})).toBe(FALLBACK_COLOR);
    expect(buildColorizer(hpAxis)({})).toBe(FALLBACK_COLOR);
  });
});

describe("resolveColorizeAxis", () => {
  it("follows the selected axis by default", () => {
    const config = deriveConfig(mons as any[]);
    expect(resolveColorizeAxis(config)?.id).toBe(config.selectedAxisId);
  });

  it("uses the locked axis when locked", () => {
    const config = { ...deriveConfig(mons as any[]), colorizeAxisId: "type1", colorizeMode: "locked" as const };
    expect(resolveColorizeAxis(config)?.id).toBe("type1");
  });

  it("falls back to axes[0] when nothing is selected", () => {
    const config = { ...deriveConfig(mons as any[]), selectedAxisId: null };
    expect(resolveColorizeAxis(config)?.id).toBe(config.axes[0].id);
  });
});

describe("deriveConfig", () => {
  it("selects the identity axis and follows it for colorizing", () => {
    const config = deriveConfig(mons as any[]);
    expect(config.selectedAxisId).toBe("id");
    expect(config.colorizeAxisId).toBeNull();
    expect(config.colorizeMode).toBe("follow");
  });

  it("selects nothing for an all-ordinal dataset", () => {
    const config = deriveConfig([{ a: "x" }, { a: "y" }]);
    expect(config.selectedAxisId).toBeNull();
    expect(resolveColorizeAxis(config)?.id).toBe("a"); // still colorizes by the first axis
  });
});
