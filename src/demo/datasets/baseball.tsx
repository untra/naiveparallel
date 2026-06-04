import type { DataObj } from "../../naiveparallel";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

/**
 * Lahman 2012: every 2012 MLB batter with 100+ at-bats (453 rows), counting
 * stats plus team and league, prepared by scripts/prepare-baseball.mjs.
 */
export const baseball: DemoDataset = {
  id: "baseball",
  title: "MLB batting 2012",
  description: "453 batters (AB ≥ 100) × 14 counting stats, team and league",
  load: () => import("../data/batting2012.json").then((m) => m.default as DataObj[]),
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          lgID: { colors: { AL: "#d50000", NL: "#1565c0" } }, // AL red, NL blue
        },
      },
      order: ["AB", "R", "H", "2B", "3B", "HR", "RBI", "SB", "BB", "SO", "teamID", "lgID"],
      hide: ["playerID", "name", "G", "CS", "IBB", "HBP", "bats", "throws"],
      select: "HR",
      colorizeLock: "lgID",
    }),
  renderRow: (row) => (
    <div>
      <strong>{row.name}</strong> · {row.teamID} ({row.lgID})
      <br />
      {row.HR} HR · {row.RBI} RBI · .{String(Math.round((row.H / row.AB) * 1000)).padStart(3, "0")}{" "}
      avg over {row.AB} AB
    </div>
  ),
};
