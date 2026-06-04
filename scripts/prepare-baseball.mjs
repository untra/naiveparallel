#!/usr/bin/env node
/**
 * Prepares src/demo/data/batting2012.json from the Lahman 2012 database.
 *
 * Source: ~/Documents/untra/lahman2012/jsons — column-oriented JSON
 * (pandas to_json: {column: {rowIndex: value}}). This script pivots to row
 * objects, keeps the 2012 season batters with AB >= 100 (453 rows), joins
 * Master for the player's name / bats / throws, and drops noise columns.
 *
 * Usage: node scripts/prepare-baseball.mjs [lahman-jsons-dir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sourceDir = process.argv[2] ?? join(homedir(), "Documents/untra/lahman2012/jsons");
const outFile = new URL("../src/demo/data/batting2012.json", import.meta.url);

/** Pivot pandas column-oriented JSON into row objects. */
function pivot(columns) {
  const keys = Object.keys(columns);
  const ids = Object.keys(columns[keys[0]]);
  return ids.map((i) => Object.fromEntries(keys.map((k) => [k, columns[k][i]])));
}

const batting = pivot(JSON.parse(readFileSync(join(sourceDir, "Batting.json"))));
const master = pivot(JSON.parse(readFileSync(join(sourceDir, "Master.json"))));

const players = new Map(master.map((m) => [m.playerID, m]));

const rows = batting
  .filter((b) => b.yearID === 2012 && b.AB >= 100)
  .map((b) => {
    const m = players.get(b.playerID) ?? {};
    return {
      playerID: b.playerID,
      name: [m.nameFirst, m.nameLast].filter(Boolean).join(" ") || b.playerID,
      bats: m.bats ?? null,
      throws: m.throws ?? null,
      teamID: b.teamID,
      lgID: b.lgID,
      G: b.G,
      AB: b.AB,
      R: b.R,
      H: b.H,
      "2B": b["2B"],
      "3B": b["3B"],
      HR: b.HR,
      RBI: b.RBI,
      SB: b.SB,
      CS: b.CS,
      BB: b.BB,
      SO: b.SO,
      IBB: b.IBB,
      HBP: b.HBP,
    };
  });

writeFileSync(outFile, JSON.stringify(rows));
console.log(`wrote ${rows.length} rows to ${outFile.pathname}`);
