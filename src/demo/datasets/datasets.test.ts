import { describe, expect, it } from "vitest";
import type { NumericalAxis, OrdinalAxis } from "../../naiveparallel";
import { DEMO_DATASETS } from "./index";
import { baseball } from "./baseball";
import { cars } from "./cars";
import { colors } from "./colors";
import { movies } from "./movies";
import { pokemon } from "./pokemon";
import { presetConfig } from "./presetConfig";
import { stocks } from "./stocks";

const axis = (config: { axes: any[] }, id: string) => config.axes.find((a) => a.id === id);

describe("DEMO_DATASETS registry", () => {
  it("offers six live tiles", () => {
    expect(DEMO_DATASETS).toHaveLength(6);
    expect(DEMO_DATASETS.filter((d) => !d.disabled).map((d) => d.id)).toEqual([
      "pokemon",
      "baseball",
      "cars",
      "xkcd-colors",
      "movies",
      "otc-stocks",
    ]);
  });
});

describe("pokemon preset", () => {
  it("reproduces the ../parallel rendering conventions", async () => {
    const rows = await pokemon.load!();
    const config = pokemon.makeConfig!(rows.filter((r) => r != null));

    // axis order leads with generation, id, the six stats, then types
    expect(config.axes.filter((a) => !a.hidden).map((a) => a.id)).toEqual([
      "generation",
      "id",
      "stats.hp",
      "stats.attack",
      "stats.defense",
      "stats.spAttack",
      "stats.spDefense",
      "stats.speed",
      "type1",
      "type2",
    ]);
    // conventional domains
    expect((axis(config, "stats.hp") as NumericalAxis).domain).toEqual([0, 255]);
    expect((axis(config, "stats.speed") as NumericalAxis).domain).toEqual([0, 255]);
    expect((axis(config, "generation") as NumericalAxis).domain).toEqual([1, 9]);
    // canonical type colors, reusable across demos
    expect((axis(config, "type1") as OrdinalAxis).colors.Fire).toBe("#EE8130");
    expect((axis(config, "type2") as OrdinalAxis).colors.Water).toBe("#6390F0");
    // lines colorized by type1, like the reference chart
    expect(config.colorizeAxisId).toBe("type1");
    expect(config.colorizeMode).toBe("locked");
    expect(config.selectedAxisId).toBe("stats.hp");
    // names hidden, not removed
    expect(axis(config, "name.en")?.hidden).toBe(true);
  });
});

describe("baseball preset", () => {
  it("loads the prepared 2012 batting slice with league colors", async () => {
    const rows = await baseball.load!();
    expect(rows).toHaveLength(453);
    const config = baseball.makeConfig!(rows);

    expect(config.axes.filter((a) => !a.hidden).map((a) => a.id)).toEqual([
      "AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "BB", "SO", "teamID", "lgID",
    ]);
    const lg = axis(config, "lgID") as OrdinalAxis;
    expect(lg.values.sort()).toEqual(["AL", "NL"]);
    expect(lg.colors.AL).toBe("#d50000");
    expect(lg.colors.NL).toBe("#1565c0");
    expect((axis(config, "teamID") as OrdinalAxis).cardinality).toBe(30);
    expect(config.selectedAxisId).toBe("HR");
    expect(config.colorizeAxisId).toBe("lgID");
    expect(axis(config, "name")?.hidden).toBe(true);
  });
});

describe("cars preset", () => {
  it("maps years, recasts cylinders, and colors origins", async () => {
    const rows = await cars.load!();
    expect(rows).toHaveLength(406); // null MPG rows are kept, not dropped
    const config = cars.makeConfig!(rows);

    const year = axis(config, "Year") as OrdinalAxis;
    expect(year.kind).toBe("ordinal");
    expect(year.values[0]).toBe("1970");
    expect(year.values[year.values.length - 1]).toBe("1982");

    const cylinders = axis(config, "Cylinders") as OrdinalAxis;
    expect(cylinders.kind).toBe("ordinal");
    expect(cylinders.source).toBe("number");
    expect(cylinders.values).toEqual(["3", "4", "5", "6", "8"]); // numeric low-to-high

    expect((axis(config, "Miles_per_Gallon") as NumericalAxis).domain).toEqual([0, 50]);
    expect((axis(config, "Origin") as OrdinalAxis).colors.Japan).toBe("#dc143c");
    expect(config.colorizeAxisId).toBe("Origin");
    expect(axis(config, "Name")?.hidden).toBe(true);
  });
});

describe("xkcd colors preset", () => {
  it("opens in components mode with r/g/b as the leading numericals", async () => {
    const rows = await colors.load!();
    expect(rows).toHaveLength(949);
    const config = colors.makeConfig!(rows);

    // r, g, b lead the visible order so components mode maps them to RGB
    expect(
      config.axes
        .filter((a) => !a.hidden)
        .slice(0, 3)
        .map((a) => a.id)
    ).toEqual(["r", "g", "b"]);
    expect(config.colorizeMode).toBe("components");
    expect(config.colorizeAxisId).toBeNull();
    expect((axis(config, "r") as NumericalAxis).domain).toEqual([0, 255]);
    expect((axis(config, "hue") as NumericalAxis).domain).toEqual([0, 360]);

    // 949 distinct names exceed MAX_ORDINAL → default first-char mapping
    const name = axis(config, "name") as OrdinalAxis;
    expect(name.kind).toBe("ordinal");
    expect(name.mapping).toBeDefined();
    expect(name.renderable).toBe(true);
    expect(axis(config, "hex")?.hidden).toBe(true);
  });
});

describe("movies preset", () => {
  it("diverges on profit and first-char-maps the big string columns", async () => {
    const rows = await movies.load!();
    expect(rows).toHaveLength(3201);
    const config = movies.makeConfig!(rows);

    // Profit crosses zero → the diverging ramp anchors at 0 when selected
    const profit = axis(config, "Profit") as NumericalAxis;
    expect(profit.domain[0]).toBeLessThan(0);
    expect(profit.domain[1]).toBeGreaterThan(0);
    expect(config.selectedAxisId).toBe("Profit");
    // distinguish colorize, no lock → drives off the selected axis (Profit)
    expect(config.colorizeMode).toBe("distinguish");
    expect(config.colorizeAxisId).toBeNull();

    // prepare script fixed the two-digit-year bug; years are plain numbers
    const year = axis(config, "Year") as NumericalAxis;
    expect(year.kind).toBe("numerical");
    expect(year.domain[0]).toBeGreaterThanOrEqual(1900);
    expect(year.domain[1]).toBeLessThanOrEqual(2012);

    // tidy ordinals render directly; oversize ones get first-char mappings
    expect((axis(config, "Major Genre") as OrdinalAxis).mapping).toBeUndefined();
    for (const id of ["Distributor", "Director"]) {
      const a = axis(config, id) as OrdinalAxis;
      expect(a.kind).toBe("ordinal");
      expect(a.mapping).toBeDefined();
      expect(a.renderable).toBe(true);
    }
    expect(axis(config, "Title")?.hidden).toBe(true);
  });
});

describe("otc stocks preset", () => {
  it("clamps the skewed domains across 2000+ rows", async () => {
    const rows = await stocks.load!();
    expect(rows.length).toBeGreaterThan(2000);
    const config = stocks.makeConfig!(rows);

    // changePerc crosses zero and is clamped well inside the data extent
    expect((axis(config, "changePerc") as NumericalAxis).domain).toEqual([-15, 15]);
    expect(Math.min(...rows.map((r) => r.changePerc))).toBeLessThan(-15);
    expect(config.selectedAxisId).toBe("changePerc");

    // penny-stock prices span seven orders of magnitude; the axis does not
    expect((axis(config, "close") as NumericalAxis).domain).toEqual([0, 50]);
    expect(Math.max(...rows.map((r) => r.close))).toBeGreaterThan(50);
    expect((axis(config, "volume") as NumericalAxis).domain).toEqual([0, 1_000_000]);

    // thousands of tickers → first-char mapping keeps the axis renderable
    const ticker = axis(config, "ticker") as OrdinalAxis;
    expect(ticker.mapping).toBeDefined();
    expect(ticker.renderable).toBe(true);
  });
});

describe("presetConfig colorize", () => {
  const rows = [
    { id: 1, a: 10, g: "x" },
    { id: 2, a: 20, g: "y" },
    { id: 3, a: 30, g: "x" },
  ];

  it("defaults to follow (the unnamed 'mapping')", () => {
    const config = presetConfig(rows);
    expect(config.colorizeMode).toBe("follow");
    expect(config.colorizeAxisId).toBeNull();
  });

  it("maps 'mapping' + colorizeLock to a locked axis", () => {
    const config = presetConfig(rows, { colorize: "mapping", colorizeLock: "g" });
    expect(config.colorizeMode).toBe("locked");
    expect(config.colorizeAxisId).toBe("g");
  });

  it("keeps 'components' as RGB with no single axis", () => {
    const config = presetConfig(rows, { colorize: "components", colorizeLock: "g" });
    expect(config.colorizeMode).toBe("components");
    expect(config.colorizeAxisId).toBeNull();
  });

  it("maps 'distinguish' alone to distinguish mode with no lock (→ selected axis)", () => {
    const config = presetConfig(rows, { colorize: "distinguish" });
    expect(config.colorizeMode).toBe("distinguish");
    expect(config.colorizeAxisId).toBeNull();
  });

  it("maps 'distinguish' + colorizeLock to distinguish that column", () => {
    const config = presetConfig(rows, { colorize: "distinguish", colorizeLock: "a" });
    expect(config.colorizeMode).toBe("distinguish");
    expect(config.colorizeAxisId).toBe("a");
  });
});
