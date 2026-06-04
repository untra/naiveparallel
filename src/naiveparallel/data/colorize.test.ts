import { describe, expect, it } from "vitest";
import mons from "../../demo/data/mons.json";
import type { NaiveParallelConfig, NumericalAxis, OrdinalAxis } from "../types";
import {
  buildColorizer,
  buildComponentColorizer,
  FALLBACK_COLOR,
  resolveColorizeAxis,
  stringToBrightGradient,
} from "./colorize";
import { deriveConfig } from "./deriveConfig";

function numAxis(id: string, domain: [number, number], extra: Partial<NumericalAxis> = {}): NumericalAxis {
  return {
    id,
    path: id,
    label: id,
    hidden: false,
    kind: "numerical",
    domain,
    allIntegers: true,
    allPositive: domain[0] >= 0,
    ...extra,
  };
}

const hpAxis = numAxis("hp", [0, 100]);

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

/** Recovers the HSL hue (0..360) from a hex color, for complementarity checks. */
function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return h * 60;
}

describe("stringToBrightGradient", () => {
  it("returns two complementary bright hex colors, deterministically", () => {
    const [lo, hi] = stringToBrightGradient("hp");
    expect(lo).toBe("#79EE2B");
    expect(hi).toBe("#A02BEE");
    expect(stringToBrightGradient("hp")).toEqual([lo, hi]);
  });

  it("places the two endpoints 180° apart on the hue wheel", () => {
    for (const id of ["hp", "attack", "speed", "stats.defense"]) {
      const [lo, hi] = stringToBrightGradient(id);
      const apart = (hexToHue(hi) - hexToHue(lo) + 360) % 360;
      expect(Math.abs(apart - 180)).toBeLessThan(2); // byte rounding tolerance
    }
  });
});

describe("buildColorizer (numerical, positive domain)", () => {
  it("sweeps between the axis' complementary pair from stringToBrightGradient", () => {
    const colorize = buildColorizer(hpAxis);
    const [lo, hi] = stringToBrightGradient("hp");
    expect(colorize({ hp: 0 })).toBe(lo);
    expect(colorize({ hp: 100 })).toBe(hi);
    // midpoint: a quarter-turn around the hue wheel from the low endpoint
    expect(colorize({ hp: 50 })).toBe("#2BDAEE");
  });

  it("clamps out-of-domain values to the endpoint colors", () => {
    const colorize = buildColorizer(hpAxis);
    expect(colorize({ hp: -50 })).toBe("#79EE2B");
    expect(colorize({ hp: 500 })).toBe("#A02BEE");
  });
});

describe("buildColorizer (numerical, domain crossing zero)", () => {
  it("diverges red (negative min) through yellow (zero) to green (positive max)", () => {
    const colorize = buildColorizer(numAxis("delta", [-100, 100]));
    expect(colorize({ delta: -100 })).toBe("#EE2B2B"); // red
    expect(colorize({ delta: 0 })).toBe("#EEEE2B"); // yellow
    expect(colorize({ delta: 100 })).toBe("#2BEE2B"); // green
  });

  it("anchors the yellow pivot at value 0, not the domain midpoint", () => {
    const colorize = buildColorizer(numAxis("delta", [-50, 200]));
    expect(colorize({ delta: 0 })).toBe("#EEEE2B"); // value 0, not midpoint 75
    expect(colorize({ delta: -25 })).toBe("#EE8C2B"); // halfway red->yellow
    expect(colorize({ delta: 100 })).toBe("#8CEE2B"); // halfway yellow->green
  });

  it("clamps out-of-domain values to the diverging endpoints", () => {
    const colorize = buildColorizer(numAxis("delta", [-100, 100]));
    expect(colorize({ delta: -500 })).toBe("#EE2B2B");
    expect(colorize({ delta: 500 })).toBe("#2BEE2B");
  });

  it("colors all-negative domains within the red-to-yellow segment", () => {
    const colorize = buildColorizer(numAxis("loss", [-80, -10]));
    expect(colorize({ loss: -80 })).toBe("#EE2B2B"); // red at min
    expect(colorize({ loss: -45 })).toBe("#EE802B"); // 35/80 of the way to zero
    expect(colorize({ loss: -10 })).toBe("#EED52B"); // near zero, near (not at) yellow
  });
});

describe("buildColorizer (temporal)", () => {
  const dateAxis = numAxis("date", [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 31)], {
    temporal: { pattern: "iso-date", source: "string" },
  });

  it("keeps the blue (early) to red (late) hue ramp", () => {
    const colorize = buildColorizer(dateAxis);
    expect(colorize({ date: "2024-01-01" })).toBe("hsl(240, 70%, 50%)");
    expect(colorize({ date: "2024-01-31" })).toBe("hsl(0, 70%, 50%)");
    expect(colorize({ date: "2024-01-16" })).toBe("hsl(120, 70%, 50%)");
  });
});

describe("buildColorizer (ordinal / fallback)", () => {
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

describe("buildComponentColorizer", () => {
  const componentsConfig = (axes: NaiveParallelConfig["axes"]): NaiveParallelConfig => ({
    axes,
    selectedAxisId: null,
    colorizeAxisId: null,
    colorizeMode: "components",
  });

  const hp = numAxis("hp", [0, 100]);
  const attack = numAxis("attack", [0, 100]);
  const speed = numAxis("speed", [0, 100]);

  it("maps the first three numerical axes to R, G, B by placement", () => {
    const colorize = buildComponentColorizer(componentsConfig([hp, attack, speed]));
    expect(colorize({ hp: 100, attack: 0, speed: 50 })).toBe("rgb(255, 0, 128)");
    expect(colorize({ hp: 100, attack: 100, speed: 100 })).toBe("rgb(255, 255, 255)");
    expect(colorize({ hp: 0, attack: 0, speed: 0 })).toBe("rgb(0, 0, 0)");
  });

  it("clamps placements to the axis domain", () => {
    const colorize = buildComponentColorizer(componentsConfig([hp, attack, speed]));
    expect(colorize({ hp: 900, attack: -5, speed: 50 })).toBe("rgb(255, 0, 128)");
  });

  it("zeroes a channel whose row value is missing", () => {
    const colorize = buildComponentColorizer(componentsConfig([hp, attack, speed]));
    expect(colorize({ hp: 100 })).toBe("rgb(255, 0, 0)");
  });

  it("skips ordinal and hidden axes when picking the three channels", () => {
    const colorize = buildComponentColorizer(
      componentsConfig([typeAxis, { ...hp, hidden: true }, attack, speed, numAxis("def", [0, 100])])
    );
    // channels are attack, speed, def — not type1/hp
    expect(colorize({ attack: 100, speed: 0, def: 100, hp: 0, type1: "Fire" })).toBe("rgb(255, 0, 255)");
  });

  it("remaps channels when the axes reorder", () => {
    const colorize = buildComponentColorizer(componentsConfig([speed, hp, attack]));
    expect(colorize({ hp: 100, attack: 0, speed: 50 })).toBe("rgb(128, 255, 0)");
  });

  it("zeroes missing channels when fewer than three numerical axes exist", () => {
    const colorize = buildComponentColorizer(componentsConfig([hp, attack]));
    expect(colorize({ hp: 100, attack: 100 })).toBe("rgb(255, 255, 0)");
  });

  it("falls back entirely without any numerical axis", () => {
    const colorize = buildComponentColorizer(componentsConfig([typeAxis]));
    expect(colorize({ type1: "Fire" })).toBe(FALLBACK_COLOR);
  });

  it("parses temporal string channels to their epoch-ms placement", () => {
    const date = numAxis("date", [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 31)], {
      temporal: { pattern: "iso-date", source: "string" },
    });
    const colorize = buildComponentColorizer(componentsConfig([date, attack, speed]));
    expect(colorize({ date: "2024-01-31", attack: 0, speed: 0 })).toBe("rgb(255, 0, 0)");
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

  it("resolves to no single axis in components mode", () => {
    const config = { ...deriveConfig(mons as any[]), colorizeMode: "components" as const };
    expect(resolveColorizeAxis(config)).toBeNull();
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
