import type { DataObj } from "../../naiveparallel";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

/**
 * The xkcd color survey (CC0): 949 crowd-named colors split into r/g/b and
 * h/s/l columns. The preset opens in "components" colorize mode with r, g, b
 * as the first three numericals, so every polyline renders in its own actual
 * color — the mode demonstrates itself. The 949-distinct name column also
 * exercises the first-char ordinal mapping.
 */
export const colors: DemoDataset = {
  id: "xkcd-colors",
  sourceFile: "colors.tsx",
  title: "xkcd colors",
  description: "949 crowd-named colors (xkcd survey) × rgb and hsl components",
  load: () => import("../data/colors.json").then((m) => m.default as DataObj[]),
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          r: { domain: [0, 255], label: "red" },
          g: { domain: [0, 255], label: "green" },
          b: { domain: [0, 255], label: "blue" },
          hue: { domain: [0, 360] },
          saturation: { domain: [0, 100] },
          lightness: { domain: [0, 100] },
        },
      },
      order: ["r", "g", "b", "hue", "saturation", "lightness", "name"],
      hide: ["hex"],
      select: "hue",
      colorize: "components",
    }),
  renderRow: (row) => (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 6,
          background: row.hex,
          border: "1px solid rgba(127,127,127,0.4)",
          flexShrink: 0,
        }}
      />
      <div>
        <strong>{row.name}</strong> · {row.hex}
        <br />
        rgb({row.r}, {row.g}, {row.b}) · hsl({row.hue}, {row.saturation}%, {row.lightness}%)
      </div>
    </div>
  ),
};
