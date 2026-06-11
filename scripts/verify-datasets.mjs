// Real-browser verification of the three new gallery datasets
// (xkcd colors / movies / OTC stocks) on the demo home page.
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5199";
const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
const chromiumDir = readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().pop();
const executablePath = path.join(
  cache,
  chromiumDir,
  "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
);

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const fail = (msg) => {
  throw new Error(`VERIFY FAIL: ${msg}`);
};

await page.goto(`${base}/#/`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="np-chart"]', { timeout: 10_000 }); // pokemon auto-loads

const heading = () => page.locator("h2").first().textContent();
const distinctColors = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="np-chart"] canvas');
    const img = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set();
    for (let p = 0; p < img.length; p += 4) {
      if (img[p + 3] > 200) colors.add(`${img[p]},${img[p + 1]},${img[p + 2]}`);
    }
    return colors.size;
  });

async function openDataset(tileText, waitAxis) {
  await page.locator("button", { hasText: tileText }).first().click();
  await page.waitForSelector(`[data-testid="np-axis-${waitAxis}"]`, { timeout: 15_000 });
  await page.waitForTimeout(600); // let the canvas paint
}

// --- xkcd colors: components mode, every line its own color ----------------
await openDataset("xkcd colors", "r");
let h = await heading();
if (!/949 rows/.test(h)) fail(`colors heading missing row count: "${h}"`);
const colorizeSelect = page.locator('select[aria-label="colorize"]');
const mode = await colorizeSelect.inputValue();
if (mode !== "__components") fail(`colors should open in components mode, got "${mode}"`);
const colorCount = await distinctColors();
console.log(`xkcd colors: ${colorCount} distinct canvas colors in components mode`);
if (colorCount < 100) fail(`components canvas should be richly colored, got ${colorCount}`);
await page.screenshot({ path: "/tmp/np-dataset-colors.png" });

// --- movies: profit diverging ramp + first-char ordinals --------------------
await openDataset("Movies", "Profit");
h = await heading();
if (!/3,?201 rows/.test(h)) fail(`movies heading missing row count: "${h}"`);
for (const id of ["Director", "Distributor", "Major Genre"]) {
  if ((await page.locator(`[data-testid="np-axis-${id}"]`).count()) < 1)
    fail(`movies axis ${id} missing`);
}
const movieColors = await distinctColors();
console.log(`movies: ${movieColors} distinct canvas colors on the Profit diverging ramp`);
if (movieColors < 10) fail("movies diverging ramp has too few colors");
await page.screenshot({ path: "/tmp/np-dataset-movies.png" });

// --- OTC stocks: 3000+ rows, clamped domains, diverging changePerc ----------
const t0 = Date.now();
await openDataset("OTC stocks", "changePerc");
console.log(`stocks: loaded + painted in ${Date.now() - t0}ms`);
h = await heading();
const rowMatch = /([\d,]+) rows/.exec(h);
if (!rowMatch || +rowMatch[1].replace(/,/g, "") < 2000)
  fail(`stocks heading should report >2000 rows: "${h}"`);
const stockColors = await distinctColors();
console.log(`stocks: ${stockColors} distinct canvas colors, heading "${h}"`);
if (stockColors < 10) fail("stocks diverging ramp has too few colors");
await page.screenshot({ path: "/tmp/np-dataset-stocks.png" });

// --- muting under overdraw: brush close+open high; the dense penny-stock ---
// mass between those two axes is then 100% filtered out and must read pale
async function brushTop(axisId) {
  const track = page.locator(`[data-testid="np-axis-${axisId}"] .np-brush-track`);
  const box = await track.boundingBox();
  if (!box) fail(`${axisId} brush track not visible`);
  const cx = box.x + box.width / 2;
  await page.mouse.move(cx, box.y + box.height * 0.02);
  await page.mouse.down();
  await page.mouse.move(cx, box.y + box.height * 0.2, { steps: 8 });
  await page.mouse.up();
  return cx;
}
const closeX = await brushTop("close");
const openX = await brushTop("open");
await page.waitForTimeout(600); // let the commit redraw

// between the close and open axes, in-filter rows stay pinned in the top
// band, so the bottom half holds only filtered-out rows — thousands of
// overlapping penny stocks that alpha-only muting composited back to vivid
const vividMuted = await page.evaluate(
  ([xa, xb]) => {
    const canvas = document.querySelector('[data-testid="np-chart"] canvas');
    const ctx = canvas.getContext("2d");
    const chart = canvas.getBoundingClientRect();
    const dpr = canvas.width / chart.width;
    const x0 = Math.ceil((Math.min(xa, xb) - chart.left + 4) * dpr);
    const w = Math.floor((Math.abs(xb - xa) - 8) * dpr);
    const y0 = Math.floor(canvas.height * 0.5);
    const img = ctx.getImageData(x0, y0, w, canvas.height - y0).data;
    let vivid = 0;
    for (let p = 0; p < img.length; p += 4) {
      if (img[p + 3] < 200) continue;
      const max = Math.max(img[p], img[p + 1], img[p + 2]);
      const min = Math.min(img[p], img[p + 1], img[p + 2]);
      if (max - min > 60 && max < 230) vivid++; // saturated AND dark = not muted
    }
    return vivid;
  },
  [closeX, openX]
);
console.log(`stocks filtered: ${vividMuted} vivid pixels in the muted close↔open slab`);
if (vividMuted > 0) fail("filtered-out dense region still composites to vivid colors");
await page.screenshot({ path: "/tmp/np-dataset-stocks-filtered.png" });

console.log("ALL VERIFICATIONS PASSED");
await browser.close();
