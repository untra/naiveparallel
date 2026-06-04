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

const temporalAxis: NumericalAxis = {
  id: "date",
  path: "date",
  label: "date",
  hidden: false,
  kind: "numerical",
  domain: [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 31)],
  allIntegers: true,
  allPositive: true,
  temporal: { pattern: "iso-date", source: "string" },
};

describe("buildScale (temporal)", () => {
  const scale = buildScale(temporalAxis, [40, 440]);

  it("maps the latest date to the top of the range", () => {
    expect(scale.y(Date.UTC(2024, 0, 31))).toBe(40);
    expect(scale.y(Date.UTC(2024, 0, 1))).toBe(440);
  });

  it("inverts a pixel back to epoch-ms (a number, not a Date)", () => {
    const v = scale.invert(40);
    expect(typeof v).toBe("number");
    expect(v).toBe(Date.UTC(2024, 0, 31));
  });

  it("clamps out-of-domain dates to the track ends", () => {
    expect(scale.y(Date.UTC(2025, 0, 1))).toBe(40); // above max -> top
    expect(scale.y(Date.UTC(2020, 0, 1))).toBe(440); // below min -> bottom
  });

  it("clamps inversion to the domain", () => {
    expect(scale.invert(0)).toBe(Date.UTC(2024, 0, 31));
    expect(scale.invert(9999)).toBe(Date.UTC(2024, 0, 1));
  });

  it("produces date-formatted ticks (not raw epoch ms)", () => {
    const ticks = scale.ticks(4);
    expect(ticks.length).toBeGreaterThan(1);
    for (const tick of ticks) {
      expect(tick.value).not.toMatch(/^\d{10,}$/); // not a giant ms integer
    }
    expect(ticks[0].y).toBeGreaterThan(ticks[ticks.length - 1].y); // earlier date sits lower
  });

  it("yields null for unmappable values", () => {
    expect(scale.y(null)).toBeNull();
    expect(scale.y("2024-01-15")).toBeNull(); // raw strings parse upstream in axisValue
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
