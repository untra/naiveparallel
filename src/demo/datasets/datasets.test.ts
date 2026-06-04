import { describe, expect, it } from "vitest";
import type { NumericalAxis, OrdinalAxis } from "../../naiveparallel";
import { DEMO_DATASETS } from "./index";
import { baseball } from "./baseball";
import { cars } from "./cars";
import { pokemon } from "./pokemon";

const axis = (config: { axes: any[] }, id: string) => config.axes.find((a) => a.id === id);

describe("DEMO_DATASETS registry", () => {
  it("offers six tiles: three live, three reserved", () => {
    expect(DEMO_DATASETS).toHaveLength(6);
    expect(DEMO_DATASETS.filter((d) => !d.disabled).map((d) => d.id)).toEqual([
      "pokemon",
      "baseball",
      "cars",
    ]);
    expect(DEMO_DATASETS.filter((d) => d.disabled)).toHaveLength(3);
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
