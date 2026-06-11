# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # vite dev server for the demo site (home + /#/test scenarios)
npm run test         # vitest run (all tests)
npm run test:watch   # vitest watch mode
npx vitest run src/naiveparallel/data/stats.test.ts          # single test file
npx vitest run -t "commits a range filter"                   # single test by name
npm run typecheck    # tsc against both tsconfig.build.json (library) and tsconfig.json (demo+tests)
npm run lint         # eslint flat config
npm run build        # library -> dist/ (ESM + CJS + bundled index.d.ts) via vite.lib.config.ts
npm run build:demo   # demo site -> dist-demo/
npm run ci           # typecheck + lint + test + build (run before declaring work done)
```

## What this is

`@untra/naiveparallel` — a compound React component rendering interactive parallel-coordinates plots from arbitrary `Array<T>` data. Only `src/naiveparallel/` is published (`files: ["dist"]`); `src/demo/` is the Vite demo app that imports the library source directly. The approved design document is at `docs/superpowers/specs/2026-06-04-naiveparallel-design.md`.

Sibling projects that define its identity: `../parallel` (the one-off d3 Pokémon chart this generalizes; demo data was copied from its assets), `../naiveasync` (render-prop component + numbered `/test` scenario page conventions), and `untra/naivetable` on GitHub (same `data: DataObj[]` input contract — not checked out locally).

## Architecture

Strictly layered; respect the dependency direction:

1. **`types.ts`** — the whole model: `ParallelAxis` (discriminated union `numerical | ordinal`), `NaiveParallelConfig`, `FilterState`, `ColumnStats`, the context value shapes, `MAX_ORDINAL`, `STAT_COLORS`.
2. **`data/`** — pure functions, **no React imports allowed**. Axis inference, dot-path accessors, stats, filter predicates, colorizers. All heavily unit-tested; `inferAxes.test.ts` and `colorize.test.ts` fixture against the real `src/demo/data/mons.json`.
3. **`context/`** — `NaiveParallelProvider` holds a `useReducer` (`reducer.ts`) plus memoized derivations. **Two separate contexts on purpose**: `NaiveParallelDataContext` (changes only when a filter/axis/selection *commits*) and `NaiveParallelInteractionContext` (hover/row-pin). Never merge them — hover must not re-render data consumers.
4. **`components/`** — the compound components (`NaiveParallel`, `ParallelChart`, `ParallelControl`, `ParallelColumn`, `ParallelRow`) all consume `useNaiveParallel()` / `useNaiveParallelInteraction()`. `NaiveParallel` with no children renders the full default UI (chart + control).

### Chart rendering contract (`components/chart/`)

- Row polylines draw to **canvas** (`LinesCanvas`, dpr-scaled); axes/brushes/stat-markers are React-rendered **SVG**. Both layers position exclusively through `buildScale()` + `ChartLayoutContext` — this shared scale is the only thing keeping canvas and SVG pixel-aligned. Never compute chart positions any other way. Filtered-out rows draw in `muteColor()` pale tints (data/colorize.ts), not just low alpha — n overlapping strokes composite to 1−(1−α)ⁿ, so alpha-only muting re-saturates under dense overdraw (thousands of penny stocks proved it).
- **Gesture model**: brushing applies the range filter **live** — `useBrush` dispatches rAF-throttled `SET_FILTER` actions during the drag (one per frame, port of the reference chart's `scheduleUpdate`), so rows/stats/markers update mid-gesture; pointer-up dispatches the final exact extent. Brushing an axis also selects it (last-brushed = active). Grabbing an existing brushed range slides it along the axis with its size preserved (move mode); a click on empty track clears the filter, a click on the range leaves it. Ordinal axes brush the same way to a **contiguous run of values**: the extent snaps to whole value bands (point ± step/2), the committed filter is the covered `enabled` set, and move mode slides in index space (never by re-inverting the snapped band, whose edges sit on nearest-neighbor tie points). Axis drag-reorder (`useAxisDrag`) still commits on pointer-up only. `HoverCanvas` is a second canvas drawing just the hovered/pinned rows so hover stays off the main canvas.
- **Pointer-target geometry**: the axis *label* is click-to-select and drag-to-reorder; the axis *track* below is the brush target (numerical and ordinal alike; ordinal tick labels are inert). These regions must never overlap — that's what prevents brush/drag conflicts.

### Domain rules baked into the pipeline

- Numbers → numerical axes; strings/booleans → ordinal. An ordinal with > `MAX_ORDINAL` (64) distinct values gets the first-char mapping `s => s[0]`; still > 64 (or URL-like values) → `renderable: false` and hidden (still listed in the control, disabled).
- After inference, an "identity" numerical axis is moved to `axes[0]` (named like id/index/key, else a unique all-integer column, else first numerical) and drives default row colorizing. Colorize either *follows* the selected axis, is *locked* to one, or maps the first three visible numerical axes onto RGB channels (`"components"` mode — reorder axes to remap; the control offers it only with ≥3 numericals). Numerical ramps by kind (`data/colorize.ts`): temporal → blue(early)→red(late) hsl; domain crossing zero → diverging red(min)→yellow(0)→green(max) anchored at value 0 (piecewise, works for all-negative domains); otherwise → a half-hue-wheel sweep between the axis' own complementary bright pair from `stringToBrightGradient(axis.id)` (S=85/L=55 hex).
- Stat marker colors are fixed by spec (`STAT_COLORS`): red max and blue min at **half thickness**, green median, cyan mean (numerical) / cyan mode (ordinal), yellow IQR bracket, magenta **dotted** lines at median±1σ (anchored on the median, not the mean); ordinal stats are mode / median / dispersion (normalized entropy).
- Numerical scales are **clamped** (`buildScale`): a configured `domain` may be narrower than the data extent (explicit axis ranges via `AxisOverride.domain` or a full `configuration`), and out-of-domain values pin to the track ends.
- Temporal axes are `NumericalAxis` with a `temporal: { pattern, source }` marker and an **epoch-ms** domain (not a third `kind`) — so all numeric filter/brush/stats/colorize paths apply unchanged. All-string columns where every value matches one ordered date pattern (`data/temporal.ts` — never bare `Date.parse`) auto-detect; numeric columns never auto-detect (force via `AxisOverride.kind: "temporal"`, treated as epoch-ms). Temporal has an **epoch floor**: `parseTemporal` rejects pre-1970 dates (a column containing one stays ordinal), and forced-numeric temporal axes treat negative ms as missing and exclude them from the domain. `buildScale` uses clamped `scaleUtc` for these; ticks and ParallelColumn stats format as UTC dates (stddev as a duration). Temporal axes are excluded from identity-axis *promotion* (a timestamp is not a row id) but may be selected if naturally first.
- Input data may contain `null` entries (mons.json literally starts with one) — everything filters them.

## Quirks worth knowing

- `vite-plugin-dts` v5: type bundling needs `bundleTypes: true` (not the old `rollupTypes`), the `@microsoft/api-extractor` devDep, **and** `rootDir: "src/naiveparallel"` in `tsconfig.build.json` — remove any one and `dist/index.d.ts` stops being emitted correctly.
- `vitest.setup.ts` stubs jsdom gaps: canvas 2d context (no-op — canvas pixel output is intentionally untested), `ResizeObserver` (reports a fixed 800×480 so `ParallelChart` computes a real layout in tests), and pointer capture. Interaction tests therefore assume an 800px-wide chart with default margins (track spans y 44..464 at the default 480 height).
- Real-browser verification: `playwright-core` is a devDep and drives the user's cached Chrome for Testing at `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/`.
- Demo `/test` page (`src/demo/routes/tests.tsx`) is a list of numbered `<Scenario>` blocks, each demonstrating exactly one capability — keep that convention when adding features.
- Demo home page is a dataset gallery driven by `src/demo/datasets/` (`DEMO_DATASETS`: pokemon/baseball/cars/xkcd-colors/movies/otc-stocks — the last three each showcase a feature: "components" RGB colorize, first-char ordinal mapping + diverging negative axis, 3,000+ rows with clamped domains). Each entry lazy-`load()`s its JSON (vite code-splits) and builds a preset via `presetConfig(rows, {inferOptions, order, hide, select, colorizeLock, colorize})` — pure post-processing of `deriveConfig`, no library API added. Custom uploads parse through `parseUpload` (d3-dsv for CSV, demo-only devDep). `cars.json` came from vega-datasets; the prepared JSONs regenerate via `node scripts/prepare-*.mjs`: `prepare-baseball.mjs` (pivots the column-oriented Lahman jsons at `~/Documents/untra/lahman2012/jsons`), `prepare-colors.mjs` (xkcd.com/color/rgb.txt, CC0), `prepare-movies.mjs` (vega-datasets CDN; fixes the two-digit-year bug, computes Profit in $M), and `prepare-stocks.mjs` (needs `MASSIVE_API_KEY`; uses the Massive **grouped-daily aggregates** endpoint — the full-market-snapshot endpoint is not entitled on the free plan — joining two trading days for changePerc).
