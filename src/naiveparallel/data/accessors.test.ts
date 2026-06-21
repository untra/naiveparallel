import { describe, expect, it } from "vitest";
import type { NumericalAxis, OrdinalAxis, TemporalAxis } from "../types";
import {
  axisValue,
  collectValues,
  discoverLeafPaths,
  ordinalValueOf,
  pathAccessor,
} from "./accessors";

const row = {
  id: 1,
  name: { en: "Bulbasaur", ja: "フシギダネ" },
  stats: { hp: 45, attack: 49 },
  type1: "Grass",
  caught: false,
  moves: ["tackle", "growl"],
  image: { sprite: "https://example.com/1.png" },
};

describe("pathAccessor", () => {
  it("reads top-level values", () => {
    expect(pathAccessor("id")(row)).toBe(1);
    expect(pathAccessor("type1")(row)).toBe("Grass");
  });

  it("reads nested values by dot path", () => {
    expect(pathAccessor("stats.hp")(row)).toBe(45);
    expect(pathAccessor("name.en")(row)).toBe("Bulbasaur");
  });

  it("returns undefined for missing paths", () => {
    expect(pathAccessor("stats.speed")(row)).toBeUndefined();
    expect(pathAccessor("nope.nope.nope")(row)).toBeUndefined();
  });
});

describe("discoverLeafPaths", () => {
  it("discovers scalar leaves depth-first, skipping arrays", () => {
    expect(discoverLeafPaths([row])).toEqual([
      "id",
      "name.en",
      "name.ja",
      "stats.hp",
      "stats.attack",
      "type1",
      "caught",
      "image.sprite",
    ]);
  });

  it("ignores null and undefined rows", () => {
    expect(discoverLeafPaths([null, undefined, { a: 1 }])).toEqual(["a"]);
  });

  it("unions paths across sampled rows", () => {
    expect(discoverLeafPaths([{ a: 1 }, { b: "x" }])).toEqual(["a", "b"]);
  });

  it("respects the sample size", () => {
    expect(discoverLeafPaths([{ a: 1 }, { b: "x" }], 1)).toEqual(["a"]);
  });
});

describe("collectValues", () => {
  it("collects non-null scalars across rows", () => {
    const rows = [{ v: 1 }, { v: null }, {}, { v: 3 }, null];
    expect(collectValues(rows, "v")).toEqual([1, 3]);
  });
});

describe("ordinalValueOf / axisValue", () => {
  const axis: OrdinalAxis = {
    id: "name.en",
    path: "name.en",
    label: "name.en",
    hidden: false,
    kind: "ordinal",
    values: ["B"],
    cardinality: 1,
    colors: {},
    source: "string",
    mapping: (s) => s.charAt(0),
    renderable: true,
  };

  it("applies the axis mapping", () => {
    expect(ordinalValueOf(axis, "Bulbasaur")).toBe("B");
    expect(axisValue(axis, row)).toBe("B");
  });

  it("yields null for missing values", () => {
    expect(ordinalValueOf(axis, null)).toBeNull();
    expect(axisValue(axis, {})).toBeNull();
  });

  it("yields null for mistyped numerical values", () => {
    const numAxis: NumericalAxis = {
      id: "stats.hp",
      path: "stats.hp",
      label: "hp",
      hidden: false,
      kind: "numerical",
      domain: [0, 255],
      allIntegers: true,
      allPositive: true,
    };
    expect(axisValue(numAxis, row)).toBe(45);
    expect(axisValue(numAxis, { stats: { hp: "oops" } })).toBeNull();
    expect(axisValue(numAxis, { stats: { hp: NaN } })).toBeNull();
  });

  it("parses temporal string rows to epoch-ms", () => {
    const temporalAxis: TemporalAxis = {
      id: "released",
      path: "released",
      label: "released",
      hidden: false,
      kind: "temporal",
      domain: [Date.UTC(2024, 0, 1), Date.UTC(2024, 11, 31)],
      allIntegers: true,
      allPositive: true,
      temporal: { pattern: "iso-date", source: "string" },
    };
    expect(axisValue(temporalAxis, { released: "2024-06-15" })).toBe(Date.UTC(2024, 5, 15));
    expect(axisValue(temporalAxis, { released: "not a date" })).toBeNull();
    expect(axisValue(temporalAxis, { released: 42 })).toBeNull(); // mistyped for a string-sourced axis
    expect(axisValue(temporalAxis, {})).toBeNull();
  });

  it("passes numbers through a number-sourced temporal axis", () => {
    const ms = Date.UTC(2024, 0, 1);
    const temporalAxis: TemporalAxis = {
      id: "t",
      path: "t",
      label: "t",
      hidden: false,
      kind: "temporal",
      domain: [ms, ms + 1000],
      allIntegers: true,
      allPositive: true,
      temporal: { pattern: "iso-datetime", source: "number" },
    };
    expect(axisValue(temporalAxis, { t: ms })).toBe(ms);
  });
});
