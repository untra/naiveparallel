import { describe, expect, it } from "vitest";
import type { FilterState, NumericalAxis, OrdinalAxis } from "../types";
import { applyFilters, makeFilterPredicate } from "./filter";

const hpAxis: NumericalAxis = {
  id: "stats.hp",
  path: "stats.hp",
  label: "hp",
  hidden: false,
  kind: "numerical",
  domain: [0, 255],
  allIntegers: true,
  allPositive: true,
};

const typeAxis: OrdinalAxis = {
  id: "type1",
  path: "type1",
  label: "type1",
  hidden: false,
  kind: "ordinal",
  values: ["Fire", "Grass", "Water"],
  cardinality: 3,
  colors: {},
  source: "string",
  renderable: true,
};

const rows = [
  { stats: { hp: 45 }, type1: "Grass" },
  { stats: { hp: 78 }, type1: "Fire" },
  { stats: { hp: 130 }, type1: "Water" },
  { stats: {}, type1: "Water" },
];

describe("makeFilterPredicate", () => {
  it("passes everything with no active filters", () => {
    const predicate = makeFilterPredicate([hpAxis, typeAxis], {});
    expect(rows.every(predicate)).toBe(true);
  });

  it("filters numerical values to the brushed range", () => {
    const filters: FilterState = { "stats.hp": { kind: "numeric", min: 50, max: 100 } };
    expect(applyFilters(rows, [hpAxis, typeAxis], filters)).toEqual([rows[1]]);
  });

  it("filters ordinal values to the enabled set", () => {
    const filters: FilterState = { type1: { kind: "ordinal", enabled: new Set(["Grass", "Fire"]) } };
    expect(applyFilters(rows, [hpAxis, typeAxis], filters)).toEqual([rows[0], rows[1]]);
  });

  it("combines filters across axes (all must pass)", () => {
    const filters: FilterState = {
      "stats.hp": { kind: "numeric", min: 0, max: 100 },
      type1: { kind: "ordinal", enabled: new Set(["Fire"]) },
    };
    expect(applyFilters(rows, [hpAxis, typeAxis], filters)).toEqual([rows[1]]);
  });

  it("fails rows with missing values on actively filtered axes", () => {
    const filters: FilterState = { "stats.hp": { kind: "numeric", min: 0, max: 255 } };
    expect(applyFilters(rows, [hpAxis, typeAxis], filters)).toHaveLength(3);
  });
});
