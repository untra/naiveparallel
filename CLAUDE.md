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

- Row polylines draw to **canvas** (`LinesCanvas`, dpr-scaled); axes/brushes/stat-markers are React-rendered **SVG**. Both layers position exclusively through `buildScale()` + `ChartLayoutContext` — this shared scale is the only thing keeping canvas and SVG pixel-aligned. Never compute chart positions any other way.
- **Gesture model**: in-flight brush/drag state is local to the hook (`useBrush`, `useAxisDrag`); the filter/reorder commits to the reducer **on pointer-up only**. Canvas layers redraw via `useEffect` on commit. `HoverCanvas` is a second canvas drawing just the hovered/pinned rows so hover stays off the main canvas.
- **Pointer-target geometry**: the axis *label* is click-to-select and drag-to-reorder; the axis *track* below is the brush target (numerical) or per-value toggles (ordinal). These regions must never overlap — that's what prevents brush/drag conflicts.

### Domain rules baked into the pipeline

- Numbers → numerical axes; strings/booleans → ordinal. An ordinal with > `MAX_ORDINAL` (64) distinct values gets the first-char mapping `s => s[0]`; still > 64 (or URL-like values) → `renderable: false` and hidden (still listed in the control, disabled).
- After inference, an "identity" numerical axis is moved to `axes[0]` (named like id/index/key, else a unique all-integer column, else first numerical) and drives default row colorizing. Colorize either *follows* the selected axis or is *locked* to one.
- Stat marker colors are fixed by spec (`STAT_COLORS`): red max, green mean, blue median, yellow ±1σ band, cyan IQR bracket, magenta min; ordinal stats are mode / median / dispersion (normalized entropy).
- Input data may contain `null` entries (mons.json literally starts with one) — everything filters them.

## Quirks worth knowing

- `vite-plugin-dts` v5: type bundling needs `bundleTypes: true` (not the old `rollupTypes`), the `@microsoft/api-extractor` devDep, **and** `rootDir: "src/naiveparallel"` in `tsconfig.build.json` — remove any one and `dist/index.d.ts` stops being emitted correctly.
- `vitest.setup.ts` stubs jsdom gaps: canvas 2d context (no-op — canvas pixel output is intentionally untested), `ResizeObserver` (reports a fixed 800×480 so `ParallelChart` computes a real layout in tests), and pointer capture. Interaction tests therefore assume an 800px-wide chart with default margins (track spans y 44..464 at the default 480 height).
- Real-browser verification: `playwright-core` is a devDep and drives the user's cached Chrome for Testing at `~/Library/Caches/ms-playwright/chromium-*/chrome-mac-arm64/`.
- Demo `/test` page (`src/demo/routes/tests.tsx`) is a list of numbered `<Scenario>` blocks, each demonstrating exactly one capability — keep that convention when adding features.
