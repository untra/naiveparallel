// One-off real-browser verification of ordinal brushing (see plan):
// jsdom can't test that ordinal tick labels no longer swallow track pointer
// events, nor real pointermove-driven live filtering. Run with the dev server
// up: node scripts/verify-ordinal-brush.mjs http://localhost:5174
import { chromium } from "playwright-core";
import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:5173";
const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
const chromiumDir = readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().pop();
if (!chromiumDir) throw new Error("no cached Chrome for Testing found");
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

await page.goto(`${base}/#/test`, { waitUntil: "networkidle" });

// Scenario 6 chart: the first chart whose axes include type1 with type colors
const axis = page.locator('[data-testid="np-axis-type1"]').first();
await axis.waitFor();
const track = axis.locator(".np-brush-track");
const box = await track.boundingBox();
if (!box) fail("type1 brush track not visible");
const cx = box.x + box.width / 2;

// 1) drag from 30% to 70% down the track -> a snapped band + disabled ticks
await page.mouse.move(cx, box.y + box.height * 0.3);
await page.mouse.down();
await page.mouse.move(cx, box.y + box.height * 0.7, { steps: 8 });
// live filtering: the brush rect should exist before mouseup
const liveRect = await axis.locator('[data-testid="np-brush-type1"]').count();
await page.mouse.up();
if (liveRect !== 1) fail("no live brush rect during ordinal drag");
const disabled = await axis.locator(".np-ordinal-disabled").count();
const total = await axis.locator(".np-ordinal-value").count();
if (disabled === 0 || disabled >= total) fail(`bad disabled tick count ${disabled}/${total}`);
console.log(`drag-brush ok: ${total - disabled}/${total} values enabled, band rendered`);

// 2) pointer-down over a tick LABEL pixel (left of the axis line) must still
// reach the track underneath — the labels are inert now
const label = axis.locator(".np-ordinal-value .np-axis-tick-label").first();
const lbox = await label.boundingBox();
if (!lbox) fail("no label box");
// only the label's right edge overlaps the 20px-wide track; aim 2px left of the axis line
await page.mouse.move(cx - 9, lbox.y + lbox.height / 2);
await page.mouse.down();
await page.mouse.move(cx - 9, lbox.y + lbox.height / 2 + 60, { steps: 4 });
await page.mouse.up();
const disabledAfter = await axis.locator(".np-ordinal-disabled").count();
if (disabledAfter === 0) fail("brush starting over a label did not filter (label swallowed it)");
console.log(`label-overlap brush ok: ${disabledAfter} ticks disabled`);

// 3) click empty track clears
const band = await axis.locator('[data-testid="np-brush-type1"]').boundingBox();
const clickY = band && band.y > box.y + 20 ? box.y + 5 : box.y + box.height - 5;
await page.mouse.click(cx, clickY);
const disabledCleared = await axis.locator(".np-ordinal-disabled").count();
if (disabledCleared !== 0) fail(`click did not clear (${disabledCleared} still disabled)`);
const rectCleared = await axis.locator('[data-testid="np-brush-type1"]').count();
if (rectCleared !== 0) fail("brush rect persisted after clear");
console.log("click-to-clear ok");

// 4) grab the band and slide it: commit a 1-value band, slide one step
await page.mouse.move(cx, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(cx, box.y + box.height * 0.52, { steps: 2 });
await page.mouse.up();
const bandBefore = await axis.locator('[data-testid="np-brush-type1"]').boundingBox();
if (!bandBefore) fail("no committed band to grab");
await page.mouse.move(cx, bandBefore.y + bandBefore.height / 2);
await page.mouse.down();
await page.mouse.move(cx, bandBefore.y + bandBefore.height / 2 + bandBefore.height, { steps: 6 });
await page.mouse.up();
const bandAfter = await axis.locator('[data-testid="np-brush-type1"]').boundingBox();
if (!bandAfter) fail("band vanished after slide");
if (Math.abs(bandAfter.height - bandBefore.height) > 1) {
  fail(`slide changed band size: ${bandBefore.height} -> ${bandAfter.height}`);
}
if (Math.abs(bandAfter.y - bandBefore.y) < bandBefore.height / 2) {
  fail("band did not move on slide");
}
console.log(`move-mode ok: band slid ${(bandAfter.y - bandBefore.y).toFixed(0)}px, size preserved`);

await page.screenshot({ path: "/tmp/ordinal-brush-verify.png" });
await browser.close();
console.log("ALL ORDINAL BRUSH CHECKS PASSED — screenshot at /tmp/ordinal-brush-verify.png");
