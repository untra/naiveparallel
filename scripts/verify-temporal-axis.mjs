// One-off real-browser verification of the temporal axis (Scenario 14):
// confirms a string ISO-date column renders date tick labels, brushes to a
// live numeric filter, shows date-formatted stats, and the control marks it
// 'cal'. Run with the dev server up:
//   node scripts/verify-temporal-axis.mjs http://localhost:5174
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

// Scenario 14 holds the only 'released' axis on the page
const scenario = page.locator("section", { has: page.locator('[data-testid="np-axis-released"]') }).last();
const axis = scenario.locator('[data-testid="np-axis-released"]');
await axis.waitFor();

// 1) date tick labels, not epoch ints
const tickTexts = await axis.locator(".np-axis-tick-label").allTextContents();
if (tickTexts.length < 2) fail(`too few ticks: ${tickTexts.length}`);
if (tickTexts.some((t) => /^\d{10,}$/.test(t.trim()))) fail(`raw epoch tick: ${tickTexts}`);
if (!tickTexts.some((t) => /[A-Za-z]/.test(t))) fail(`no date-like tick label: ${tickTexts}`);
console.log(`date ticks ok: ${tickTexts.join(" | ")}`);

// 2) the control marks the axis 'cal'
const kind = await scenario
  .locator('[data-testid="np-control-axis-released"] .np-control-kind')
  .textContent();
if (kind !== "cal") fail(`control kind is '${kind}', expected 'cal'`);
console.log("control 'cal' indicator ok");

// 3) brush the lower 60% of the track -> live filter drops late-year rows
// (raw page.mouse does not auto-scroll; bring the scenario into the viewport first)
const track = axis.locator(".np-brush-track");
await track.scrollIntoViewIfNeeded();
const box = await track.boundingBox();
if (!box) fail("released brush track not visible");
const cx = box.x + box.width / 2;
await page.mouse.move(cx, box.y + box.height * 0.4);
await page.mouse.down();
await page.mouse.move(cx, box.y + box.height, { steps: 8 });
const liveRect = await axis.locator('[data-testid="np-brush-released"]').count();
await page.mouse.up();
if (liveRect !== 1) fail("no live brush rect during temporal drag");
const rect = await axis.locator('[data-testid="np-brush-released"]').boundingBox();
if (!rect) fail("no committed brush rect");
console.log(`temporal brush ok: rect height ${rect.height.toFixed(0)}px`);

// 4) the column reports date-formatted stats for the brushed (selected) axis
const column = scenario.locator('[data-testid="np-column"]');
const text = (await column.textContent()) ?? "";
if (!/\d{4}-\d{2}-\d{2}/.test(text)) fail(`no date-formatted stat in column: ${text}`);
if (/\d{12,}/.test(text)) fail(`raw epoch-ms leaked into column: ${text}`);
if (!/±1σ\s*[\d.]+(d|h|m|s)/.test(text)) fail(`stddev not a duration: ${text}`);
console.log(`temporal column stats ok: ${text.slice(0, 120)}`);

// 5) click empty track clears the filter
await page.mouse.click(cx, box.y + 4);
const rectCleared = await axis.locator('[data-testid="np-brush-released"]').count();
if (rectCleared !== 0) fail("brush rect persisted after clear");
console.log("click-to-clear ok");

await scenario.screenshot({ path: "/tmp/temporal-axis-verify.png" });
await browser.close();
console.log("ALL TEMPORAL AXIS CHECKS PASSED — screenshot at /tmp/temporal-axis-verify.png");
