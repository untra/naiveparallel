#!/usr/bin/env node
/**
 * Prepares src/demo/data/movies.json from the vega-datasets movies table
 * (BSD-3): 3,201 films with grosses, budgets, ratings, and release dates.
 *
 * Transforms applied:
 * - `Release Date` ("Mon D YYYY") → numeric `Year`; the dataset's known
 *   two-digit-year bug (films "released" after 2012, e.g. 2046) is fixed by
 *   subtracting a century. Pre-1970 years are genuine and kept — which is
 *   also why Year stays a plain number instead of a temporal axis (the
 *   library's temporal axes have an epoch floor).
 * - `Profit` = Worldwide Gross − Production Budget, in $M (negative for
 *   ~1,100 flops); the dollar columns are likewise converted to $M.
 *
 * Usage: node scripts/prepare-movies.mjs
 */
import { writeFileSync } from "node:fs";

const sourceUrl = "https://cdn.jsdelivr.net/npm/vega-datasets@2/data/movies.json";
const outFile = new URL("../src/demo/data/movies.json", import.meta.url);

const millions = (dollars) =>
  dollars == null ? null : Math.round(dollars / 100_000) / 10;

function releaseYear(date) {
  const m = /(\d{4})$/.exec(date ?? "");
  if (!m) return null;
  const year = +m[1];
  return year > 2012 ? year - 100 : year;
}

const source = await fetch(sourceUrl).then((res) => {
  if (!res.ok) throw new Error(`${sourceUrl} -> ${res.status}`);
  return res.json();
});

const rows = source.map((movie) => {
  const worldwide = millions(movie["Worldwide Gross"]);
  const budget = millions(movie["Production Budget"]);
  return {
    Title: movie.Title,
    Year: releaseYear(movie["Release Date"]),
    Profit:
      worldwide == null || budget == null
        ? null
        : Math.round((worldwide - budget) * 10) / 10,
    "Production Budget": budget,
    "Worldwide Gross": worldwide,
    "US Gross": millions(movie["US Gross"]),
    "Running Time min": movie["Running Time min"],
    "IMDB Rating": movie["IMDB Rating"],
    "IMDB Votes": movie["IMDB Votes"],
    "Rotten Tomatoes Rating": movie["Rotten Tomatoes Rating"],
    "MPAA Rating": movie["MPAA Rating"],
    "Major Genre": movie["Major Genre"],
    "Creative Type": movie["Creative Type"],
    Source: movie.Source,
    Distributor: movie.Distributor,
    Director: movie.Director,
  };
});

writeFileSync(outFile, JSON.stringify(rows));
console.log(`wrote ${rows.length} rows to ${outFile.pathname}`);
