import type { DataObj } from "../../naiveparallel";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

/**
 * One trading day of every OTC security with a prior close, from the Massive
 * API's grouped-daily aggregates (prepared by scripts/prepare-stocks.mjs).
 * The scale showcase: 3,000+ canvas polylines stay brushable, and the wildly
 * skewed penny-stock distributions (closes from $0.000001 to $25,500) lean
 * on clamped domains — outliers pin to the track ends. changePerc crosses
 * zero, so the selected axis gets the diverging ramp.
 */
export const stocks: DemoDataset = {
  id: "otc-stocks",
  title: "OTC stocks 6/10/2026",
  description: "3,000+ OTC tickers (Massive API) x one day of price, volume, and OLHC change",
  load: () => import("../data/otcstocks.json").then((m) => m.default as DataObj[]),
  // 3,000+ rows make the live filter counter's payoff especially vivid
  hints: true,
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          changePerc: { domain: [-15, 15], label: "change %" },
          open: { domain: [0, 50] },
          high: { domain: [0, 50] },
          low: { domain: [0, 50] },
          close: { domain: [0, 50] },
          vwap: { domain: [0, 50] },
          volume: { domain: [0, 1_000_000] },
          trades: { domain: [0, 2000] },
        },
      },
      order: ["ticker", "changePerc", "close", "open", "high", "low", "vwap", "volume", "trades"],
      select: "changePerc",
    }),
  renderRow: (row) => (
    <div>
      <strong>{row.ticker}</strong> · ${row.close} ·{" "}
      {row.changePerc > 0 ? `+${row.changePerc}` : row.changePerc}%
      <br />
      {Number(row.volume).toLocaleString()} shares over {row.trades} trades · vwap ${row.vwap}
    </div>
  ),
};
