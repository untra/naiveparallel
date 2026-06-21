import type { DataObj } from "../../naiveparallel";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

/**
 * The vega-datasets movies table (BSD-3): 3,201 films prepared by
 * scripts/prepare-movies.mjs. String-heavy on purpose — tidy ordinals
 * (genre, MPAA rating, creative type, source) next to Distributor (174
 * distinct) and Director (550 distinct), which exceed MAX_ORDINAL and get
 * the first-char mapping. Profit ($M) is negative for ~1,100 flops.
 *
 * Colorized with `colorize: "distinguish"`: with no colorizeLock the rows take
 * a unique, stable per-row color from the selected axis (Profit) — its rank,
 * z-score, and folded-median deviation mapped to HSV hue / saturation /
 * brightness (saturation kept high so no row reads as washed-out).
 *
 * Also showcases the chart-level `stats` option: the selected axis' markers
 * are recolored (custom red max / blue min) and trimmed (mean and ±1σ hidden)
 * so the median and IQR read clearly without the extra statistical noise.
 */
export const movies: DemoDataset = {
  id: "movies",
  title: "Movies",
  description: "3,201 films (vega-datasets) x profit, grosses, ratings, and genre strings",
  load: () => import("../data/movies.json").then((m) => m.default as DataObj[]),
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          Profit: { label: "profit $M", domain: [-50, 300] },
          "Production Budget": { label: "budget $M", domain: [0, 300] },
          "Worldwide Gross": { label: "gross $M", domain: [0, 1000] },
          "Running Time min": { label: "runtime" },
          "IMDB Rating": { domain: [0, 10], label: "IMDB" },
          "IMDB Votes": { label: "votes" },
          "Rotten Tomatoes Rating": { domain: [0, 100], label: "tomatoes" },
          "MPAA Rating": { label: "MPAA" },
          "Major Genre": { label: "genre" },
          "Creative Type": { label: "creative type" },
        },
      },
      order: [
        "Profit",
        "Production Budget",
        "Worldwide Gross",
        "IMDB Rating",
        "Rotten Tomatoes Rating",
        "IMDB Votes",
        "Running Time min",
        "Year",
        "Major Genre",
        "Creative Type",
        "MPAA Rating",
        "Source",
        "Distributor",
        "Director",
      ],
      hide: ["Title", "US Gross"],
      select: "Profit",
      colorize: "distinguish",
      stats: {
        enabled: true,
        colors: {
          max: "#e0245e", // custom red
          min: "#1d9bf0", // custom blue
          mean: false, // hidden — keep median, drop mean
          stddev: false, // hidden — drop the ±1σ lines
          // median / iqr omitted -> default green / yellow
        },
      },
    }),
  renderRow: (row) => (
    <div>
      <strong>{row.Title}</strong> ({row.Year ?? "?"}) · {row["Major Genre"] ?? "—"} ·{" "}
      {row["MPAA Rating"] ?? "unrated"}
      <br />
      {row.Profit != null ? `${row.Profit < 0 ? "-" : "+"}$${Math.abs(row.Profit)}M` : "?"} on a $
      {row["Production Budget"] ?? "?"}M budget · IMDB {row["IMDB Rating"] ?? "?"}
    </div>
  ),
};
