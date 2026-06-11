#!/usr/bin/env node
/**
 * Prepares src/demo/data/otcstocks.json from the Massive API's grouped-daily
 * aggregates (https://massive.com/docs/rest/stocks/aggregates/...). The
 * full-market-snapshot endpoint is not entitled on the free plan; grouped
 * daily covers the same need: one bar per ticker for a whole trading day,
 * OTC securities included via include_otc=true.
 *
 * Fetches the target day plus the previous trading day, keeps OTC tickers
 * present on both, and computes changePerc from the prior close — giving the
 * demo a numerical axis that crosses zero. Floats are rounded to 4
 * significant digits (penny stocks trade at 1e-6) to keep the JSON small.
 *
 * Usage: MASSIVE_API_KEY=... node scripts/prepare-stocks.mjs [YYYY-MM-DD]
 *        (date defaults to the most recent completed weekday; holidays with
 *        no data are walked past automatically)
 */
import { writeFileSync } from "node:fs";

const apiKey = process.env.MASSIVE_API_KEY;
if (!apiKey) {
  console.error("MASSIVE_API_KEY is not set — export it or prefix the command.");
  process.exit(1);
}
const outFile = new URL("../src/demo/data/otcstocks.json", import.meta.url);

const isoDate = (d) => d.toISOString().slice(0, 10);

/** The latest weekday strictly before the given UTC date. */
function previousWeekday(date) {
  const d = new Date(date);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d;
}

async function groupedDaily(date) {
  const url =
    `https://api.massive.com/v2/aggs/grouped/locale/us/market/stocks/${isoDate(date)}` +
    `?adjusted=true&include_otc=true&apiKey=${apiKey}`;
  const body = await fetch(url).then((res) => res.json());
  if (body.status !== "OK") throw new Error(`${isoDate(date)}: ${body.status} ${body.message ?? ""}`);
  return body.results ?? [];
}

/** Walks back from the given date until a trading day with results. */
async function latestTradingDay(date) {
  for (let d = date, tries = 0; tries < 10; d = previousWeekday(d), tries++) {
    const results = await groupedDaily(d);
    if (results.length > 0) return { date: d, results };
  }
  throw new Error("no trading data found in the last 10 weekdays");
}

const sig4 = (x) => (x == null ? null : Number(x.toPrecision(4)));

const start = process.argv[2] ? new Date(`${process.argv[2]}T00:00:00Z`) : previousWeekday(new Date());
const day = await latestTradingDay(start);
const prev = await latestTradingDay(previousWeekday(day.date));

const prevClose = new Map(
  prev.results.filter((r) => r.otc && r.c > 0).map((r) => [r.T, r.c])
);

const rows = day.results
  .filter((r) => r.otc && prevClose.has(r.T))
  .map((r) => ({
    ticker: r.T,
    open: sig4(r.o),
    high: sig4(r.h),
    low: sig4(r.l),
    close: sig4(r.c),
    vwap: sig4(r.vw),
    volume: Math.round(r.v),
    trades: r.n ?? 0,
    changePerc: Math.round(((r.c - prevClose.get(r.T)) / prevClose.get(r.T)) * 10000) / 100,
  }));

writeFileSync(outFile, JSON.stringify(rows));
console.log(
  `wrote ${rows.length} OTC rows for ${isoDate(day.date)} (prev ${isoDate(prev.date)}) to ${outFile.pathname}`
);
