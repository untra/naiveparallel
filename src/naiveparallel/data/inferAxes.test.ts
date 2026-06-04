import { describe, expect, it } from "vitest";
import mons from "../../demo/data/mons.json";
import type { NumericalAxis, OrdinalAxis } from "../types";
import { MAX_ORDINAL } from "../types";
import { firstCharMapping, inferAxes, inferAxis, selectIdentityAxis } from "./inferAxes";

const byId = (axes: ReturnType<typeof inferAxes>, id: string) => axes.find((a) => a.id === id);

describe("inferAxis", () => {
  it("infers a numerical axis from numbers with domain and flags", () => {
    const axis = inferAxis({
      path: "hp",
      values: [45, 60, 80.5, -10],
      maxOrdinal: MAX_ORDINAL,
    }) as NumericalAxis;
    expect(axis.kind).toBe("numerical");
    expect(axis.domain).toEqual([-10, 80.5]);
    expect(axis.allIntegers).toBe(false);
    expect(axis.allPositive).toBe(false);
  });

  it("flags all-integer, all-positive numbers", () => {
    const axis = inferAxis({ path: "n", values: [1, 2, 3], maxOrdinal: 64 }) as NumericalAxis;
    expect(axis.allIntegers).toBe(true);
    expect(axis.allPositive).toBe(true);
  });

  it("infers an ordinal axis from strings, ordered low to high", () => {
    const axis = inferAxis({
      path: "type",
      values: ["Water", "Fire", "Grass", "Fire"],
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.kind).toBe("ordinal");
    expect(axis.values).toEqual(["Fire", "Grass", "Water"]);
    expect(axis.cardinality).toBe(3);
    expect(axis.renderable).toBe(true);
    expect(axis.source).toBe("string");
  });

  it("infers ordinals from booleans", () => {
    const axis = inferAxis({
      path: "caught",
      values: [true, false, true],
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.source).toBe("boolean");
    expect(axis.values).toEqual(["false", "true"]);
  });

  it("treats numbers as ordinal when overridden, ordering numerically", () => {
    const axis = inferAxis({
      path: "generation",
      values: [10, 2, 1],
      override: { kind: "ordinal" },
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.source).toBe("number");
    expect(axis.values).toEqual(["1", "2", "10"]);
  });

  it("falls back to first-character mapping when a string space exceeds the cap", () => {
    const values = Array.from({ length: 100 }, (_, i) => `${String.fromCharCode(65 + (i % 5))}name${i}`);
    const axis = inferAxis({ path: "name", values, maxOrdinal: 64 }) as OrdinalAxis;
    expect(axis.mapping).toBe(firstCharMapping);
    expect(axis.values).toEqual(["A", "B", "C", "D", "E"]);
    expect(axis.renderable).toBe(true);
  });

  it("prefers a configured mapping over the first-character fallback", () => {
    const values = Array.from({ length: 100 }, (_, i) => `prefix-${i % 3}-${i}`);
    const axis = inferAxis({
      path: "name",
      values,
      override: { mapping: (s) => s.split("-")[1] },
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.values).toEqual(["0", "1", "2"]);
  });

  it("marks a still-too-large ordinal as unrenderable", () => {
    const values = Array.from({ length: 100 }, (_, i) => `v${i}`);
    const axis = inferAxis({
      path: "huge",
      values,
      override: { mapping: (s) => s }, // identity mapping keeps the space large
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.renderable).toBe(false);
    expect(axis.hidden).toBe(true);
  });

  it("marks URL-like string axes unrenderable and hidden", () => {
    const values = Array.from({ length: 100 }, (_, i) => `https://example.com/${i}.png`);
    const axis = inferAxis({ path: "image.sprite", values, maxOrdinal: 64 }) as OrdinalAxis;
    expect(axis.renderable).toBe(false);
    expect(axis.hidden).toBe(true);
  });

  it("assigns per-value colors by index from override arrays", () => {
    const axis = inferAxis({
      path: "t",
      values: ["b", "a"],
      override: { colors: ["#111", "#222"] },
      maxOrdinal: 64,
    }) as OrdinalAxis;
    expect(axis.colors).toEqual({ a: "#111", b: "#222" });
  });

  it("returns null when no scalar values exist", () => {
    expect(inferAxis({ path: "x", values: [], maxOrdinal: 64 })).toBeNull();
  });
});

describe("selectIdentityAxis", () => {
  it("prefers an axis named like an identifier", () => {
    const axes = inferAxes([
      { score: 1.5, id: 7, label: "a" },
      { score: 2.5, id: 8, label: "b" },
    ]);
    expect(axes[0].id).toBe("id");
  });

  it("falls back to a unique all-integer axis (a row id)", () => {
    const data = [
      { score: 1.5, code: 101 },
      { score: 1.5, code: 102 },
    ];
    const axes = inferAxes(data);
    expect(axes[0].id).toBe("code");
  });

  it("falls back to the first numerical axis", () => {
    const data = [
      { name: "a", score: 1.5, other: 2.5 },
      { name: "b", score: 1.5, other: 3.5 }, // unique but not integers — not a row id
    ];
    expect(selectIdentityAxis(inferAxes(data), data)?.id).toBe("score");
  });

  it("returns null for an all-ordinal dataset", () => {
    const data = [{ name: "a" }, { name: "b" }];
    expect(selectIdentityAxis(inferAxes(data), data)).toBeNull();
  });
});

describe("inferAxes over the Pokemon dataset", () => {
  const axes = inferAxes(mons as any[]);

  it("guards the leading null row", () => {
    expect((mons as any[])[0]).toBeNull();
    expect(axes.length).toBeGreaterThan(0);
  });

  it("puts the identity numerical axis (id) at position [0]", () => {
    expect(axes[0].id).toBe("id");
    expect(axes[0].kind).toBe("numerical");
  });

  it("infers nested stat paths as all-integer numerical axes", () => {
    const hp = byId(axes, "stats.hp") as NumericalAxis;
    expect(hp.kind).toBe("numerical");
    expect(hp.allIntegers).toBe(true);
    expect(hp.allPositive).toBe(true);
    expect(hp.domain[0]).toBeGreaterThan(0);
    expect(hp.domain[1]).toBeLessThanOrEqual(255);
  });

  it("infers type1 as a renderable 18-value ordinal", () => {
    const type1 = byId(axes, "type1") as OrdinalAxis;
    expect(type1.kind).toBe("ordinal");
    expect(type1.cardinality).toBe(18);
    expect(type1.renderable).toBe(true);
    expect(Object.keys(type1.colors)).toHaveLength(18);
  });

  it("reduces the 898-unique name.en space via first-character mapping", () => {
    const name = byId(axes, "name.en") as OrdinalAxis;
    expect(name.mapping).toBe(firstCharMapping);
    expect(name.cardinality).toBeLessThanOrEqual(MAX_ORDINAL);
    expect(name.renderable).toBe(true);
  });

  it("hides URL-like image axes as unrenderable", () => {
    const sprite = byId(axes, "image.sprite") as OrdinalAxis;
    expect(sprite.renderable).toBe(false);
    expect(sprite.hidden).toBe(true);
  });
});
