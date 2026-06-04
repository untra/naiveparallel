// Real-browser verification of the colorize overhaul (scenarios 9 + 15).
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
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const fail = (msg) => {
  throw new Error(`VERIFY FAIL: ${msg}`);
};

await page.goto(`${base}/#/test`, { waitUntil: "networkidle" });
await page.waitForTimeout(800); // let canvases paint

const scenario = (n) => page.locator("section", { has: page.locator("h2", { hasText: new RegExp(`^${n}\\.`) }) });

// --- Scenario 9: follow vs locked, per-axis ramps ---------------------------
const s9 = scenario(9);
await s9.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await s9.screenshot({ path: "/tmp/np-s9-follow.png" });

// canvas pixel sample helper: distinct colors on the first canvas of a section
const distinctColors = (sectionIndex) =>
  page.evaluate((i) => {
    const canvas = document.querySelectorAll("section")[i].querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const img = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set();
    for (let p = 0; p < img.length; p += 4) {
      if (img[p + 3] > 200) colors.add(`${img[p]},${img[p + 1]},${img[p + 2]}`);
    }
    return colors.size;
  }, sectionIndex);

const sections = await page.locator("section").count();
const sectionIndexOf = async (n) => {
  for (let i = 0; i < sections; i++) {
    const h = await page.locator("section").nth(i).locator("h2").textContent();
    if (h.startsWith(`${n}.`)) return i;
  }
  fail(`scenario ${n} not found`);
};

const i9 = await sectionIndexOf(9);
const followColors = await distinctColors(i9);
if (followColors < 10) fail(`scenario 9 follow-mode canvas has too few colors (${followColors})`);
console.log(`s9 follow-mode distinct canvas colors: ${followColors}`);

// lock colorize to a zero-crossing-free numerical axis, then check select works
const s9select = s9.locator('select[aria-label="colorize"]');
await s9select.selectOption({ label: "lock to stats.attack" });
await page.waitForTimeout(400);
await s9.screenshot({ path: "/tmp/np-s9-locked-attack.png" });
const lockedColors = await distinctColors(i9);
console.log(`s9 locked-to-attack distinct canvas colors: ${lockedColors}`);
if (lockedColors < 10) fail("scenario 9 locked-mode canvas has too few colors");

// --- Scenario 15: RGB color components --------------------------------------
const s15 = scenario(15);
await s15.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
const s15select = s15.locator('select[aria-label="colorize"]');
const selected = await s15select.inputValue();
if (selected !== "__components") fail(`scenario 15 select should start on __components, got "${selected}"`);
await s15.screenshot({ path: "/tmp/np-s15-components.png" });
const i15 = await sectionIndexOf(15);
const rgbColors = await distinctColors(i15);
console.log(`s15 components distinct canvas colors: ${rgbColors}`);
if (rgbColors < 10) fail("scenario 15 components canvas has too few colors");

// probe: reorder axes (move attack down) -> channels remap -> pixels change
const pixelHash = (i) =>
  page.evaluate((idx) => {
    const canvas = document.querySelectorAll("section")[idx].querySelector("canvas");
    const img = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let h = 0;
    for (let p = 0; p < img.length; p += 97) h = (h * 31 + img[p]) >>> 0;
    return h;
  }, i);
const before = await pixelHash(i15);
await s15.locator('button[aria-label="move attack down"]').click();
await page.waitForTimeout(400);
const after = await pixelHash(i15);
if (before === after) fail("scenario 15 pixels unchanged after axis reorder (channels should remap)");
console.log(`s15 reorder remapped channels: pixel hash ${before} -> ${after}`);
await s15.screenshot({ path: "/tmp/np-s15-reordered.png" });

// probe: switch s15 back to follow mode -> still renders, no crash
await s15select.selectOption({ index: 0 });
await page.waitForTimeout(300);
const followAgain = await distinctColors(i15);
console.log(`s15 back-to-follow distinct colors: ${followAgain}`);
if (followAgain < 5) fail("scenario 15 follow-mode after switching back has too few colors");

// probe: scenario 14 temporal axis still renders (epoch floor didn't break post-1970 dates)
const s14 = scenario(14);
await s14.scrollIntoViewIfNeeded();
const calBadge = await s14.locator(".np-control-kind", { hasText: "cal" }).count();
if (calBadge < 1) fail("scenario 14 temporal axis lost its 'cal' badge");
console.log("s14 temporal axis still detects (cal badge present)");
await s14.screenshot({ path: "/tmp/np-s14-temporal.png" });

console.log("ALL VERIFICATIONS PASSED");
await browser.close();
