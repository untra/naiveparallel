#!/usr/bin/env node
/**
 * Prepares src/demo/data/colors.json from the xkcd color survey.
 *
 * Source: https://xkcd.com/color/rgb.txt (CC0) — 949 crowd-named colors as
 * `name\t#hex` lines after a license comment. Each row gets the hex split
 * into r/g/b channels plus derived hue/saturation/lightness, so the demo's
 * "components" colorize mode can draw every polyline in its own color.
 *
 * Usage: node scripts/prepare-colors.mjs
 */
import { writeFileSync } from "node:fs";

const sourceUrl = "https://xkcd.com/color/rgb.txt";
const outFile = new URL("../src/demo/data/colors.json", import.meta.url);

/** Standard RGB → HSL; hue in degrees, saturation/lightness in percent. */
function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { hue: 0, saturation: 0, lightness: Math.round(l * 100) };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h = (h * 60 + 360) % 360;
  return {
    hue: Math.round(h),
    saturation: Math.round(s * 100),
    lightness: Math.round(l * 100),
  };
}

const text = await fetch(sourceUrl).then((res) => {
  if (!res.ok) throw new Error(`${sourceUrl} -> ${res.status}`);
  return res.text();
});

const rows = text
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"))
  .map((line) => {
    const [name, hex] = line.split("\t");
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { name, hex, r, g, b, ...rgbToHsl(r, g, b) };
  });

writeFileSync(outFile, JSON.stringify(rows));
console.log(`wrote ${rows.length} rows to ${outFile.pathname}`);
