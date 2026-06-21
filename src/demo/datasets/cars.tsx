import type { DataObj } from "../../naiveparallel";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

/**
 * The classic vega-datasets cars table: 406 cars, 1970–1982. Exercises null
 * values (8 missing MPG), date-string -> year ordinal mapping, and a numeric
 * column (Cylinders) recast as an ordinal.
 */
export const cars: DemoDataset = {
  id: "cars",
  title: "Cars",
  description: "406 cars (vega-datasets) x mpg, power, weight, origin, 1970-82",
  load: () => import("../data/cars.json").then((m) => m.default as DataObj[]),
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          Miles_per_Gallon: { domain: [0, 50], label: "mpg" },
          Cylinders: { kind: "ordinal" },
          Displacement: { domain: [0, 500] },
          Horsepower: { domain: [0, 250] },
          Weight_in_lbs: { domain: [1500, 5500], label: "weight" },
          Acceleration: { domain: [5, 25] },
          Year: { kind: "ordinal", mapping: (s) => s.slice(0, 4) },
          Origin: { colors: { USA: "#4682b4", Europe: "#d4a017", Japan: "#dc143c" } },
        },
      },
      order: [
        "Miles_per_Gallon",
        "Cylinders",
        "Displacement",
        "Horsepower",
        "Weight_in_lbs",
        "Acceleration",
        "Year",
        "Origin",
      ],
      hide: ["Name"],
      select: "Miles_per_Gallon",
      colorizeLock: "Origin",
    }),
  renderRow: (row) => (
    <div>
      <strong>{row.Name}</strong> · {row.Origin} · {String(row.Year).slice(0, 4)}
      <br />
      {row.Miles_per_Gallon ?? "?"} mpg · {row.Horsepower ?? "?"} hp · {row.Cylinders} cyl ·{" "}
      {row.Weight_in_lbs} lbs
    </div>
  ),
};
