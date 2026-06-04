import { describe, expect, it } from "vitest";
import type { NumericalAxis, OrdinalAxis } from "../../types";
import { buildScale } from "./scales";

const numAxis: NumericalAxis = {
  id: "hp",
  path: "hp",
  label: "hp",
  hidden: false,
  kind: "numerical",
  domain: [0, 100],
  allIntegers: true,
  allPositive: true,
};

const ordAxis: OrdinalAxis = {
  id: "type",
  path: "type",
  label: "type",
  hidden: false,
  kind: "ordinal",
  values: ["a", "b", "c"],
  cardinality: 3,
  colors: {},
  source: "string",
  renderable: true,
};

describe("buildScale (numerical)", () => {
  const scale = buildScale(numAxis, [40, 440]);

  it("maps high values to the top of the range", () => {
    expect(scale.y(100)).toBe(40);
    expect(scale.y(0)).toBe(440);
    expect(scale.y(50)).toBe(240);
  });

  it("yields null for unmappable values", () => {
    expect(scale.y(null)).toBeNull();
    expect(scale.y("nope")).toBeNull();
    expect(scale.y(NaN)).toBeNull();
  });

  it("inverts pixels back to values", () => {
    expect(scale.invert(240)).toBe(50);
    expect(scale.invert(40)).toBe(100);
  });

  it("clamps out-of-domain values to the axis ends", () => {
    // an explicit configured domain may be narrower than the data extent
    expect(scale.y(250)).toBe(40); // above domain max -> top of track
    expect(scale.y(-50)).toBe(440); // below domain min -> bottom of track
  });

  it("clamps inversion to the domain", () => {
    expect(scale.invert(0)).toBe(100);
    expect(scale.invert(9999)).toBe(0);
  });

  it("produces numeric ticks", () => {
    const ticks = scale.ticks(5);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0].y).toBeGreaterThan(ticks[ticks.length - 1].y); // low value sits lower
  });

  it("has no point step", () => {
    expect(scale.step()).toBeNull();
  });
});

describe("buildScale (ordinal)", () => {
  const scale = buildScale(ordAxis, [0, 300]);

  it("spaces values with point-scale padding", () => {
    const ys = ordAxis.values.map((v) => scale.y(v)!);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    expect(ys[1]).toBe(150); // middle of the range
  });

  it("ticks every value", () => {
    expect(scale.ticks().map((t) => t.value)).toEqual(["a", "b", "c"]);
  });

  it("inverts a pixel to the nearest value", () => {
    expect(scale.invertPoint(0)).toBe("a");
    expect(scale.invertPoint(151)).toBe("b");
    expect(scale.invertPoint(299)).toBe("c");
  });

  it("yields null for non-string lookups and numeric inversion", () => {
    expect(scale.y(42)).toBeNull();
    expect(scale.invert(150)).toBeNull();
  });

  it("exposes the point-scale step", () => {
    // padding 0.5, 3 values over 300px: step = 300 / 3
    expect(scale.step()).toBe(100);
  });
});
