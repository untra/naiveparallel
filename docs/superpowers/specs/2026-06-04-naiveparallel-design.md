# Plan: Bootstrap `@untra/naiveparallel`

## Context

`naiveparallel` (currently an empty git repo at `/Users/samuelvolin/Documents/untra/naiveparallel`) is a new compound React component library for rendering highly-interactive parallel coordinates plots from arbitrary `Array<T>` datasets. It generalizes the one-off d3 Pokémon chart at `../parallel/assets/js/chart.js` into an abstract, dataset-neutral component; follows the "exotic component" render-prop philosophy of `../naiveasync` (children receive contextual state for free-form styling); and accepts the same `data: DataObj[]` input shape as `@untra/naivetable`.

Target API:
```tsx
<NaiveParallel data={data} configuration={undefined}>
  <ParallelControl /> <ParallelColumn /> <ParallelChart /> <ParallelRow>{ctx => ...}</ParallelRow>
</NaiveParallel>
```

**Decisions confirmed with the user:**
1. **Rendering:** React-rendered SVG for axes/brushes/labels/stat-markers; row polylines on a `<canvas>` layer underneath for large-volume performance. d3-scale/d3-array for math only — no d3 DOM manipulation, no d3-brush (brushing via React pointer events).
2. **Tooling:** Vite library mode (+ vite-plugin-dts) emitting ESM+CJS+types; Vite demo app; vitest + @testing-library/react; peer dep `react >= 18`.
3. **Default UI:** `<NaiveParallel data={data} />` with no children renders full default Control + Chart (NaiveTable-style).
4. **Identity:** npm `@untra/naiveparallel`; repo includes a demo site (home + numbered `/test` scenarios page like naiveasync) using the Pokémon dataset from `../parallel/assets/data/` (mons.json ~898 rows, types.json, typeColors.json).

**Verified data realities driving the design:** mons.json literally begins with a `null` element; rows have nested objects (`name.en`, `stats.hp`, `image.*`); `name.en` has 898 unique values (exercises the first-char mapping fallback); `type1/type2` cardinality is 18. So flat `Object.keys(data[0])` is insufficient — path-based leaf discovery is mandatory.

**Reference patterns to reuse (read-only):**
- `../parallel/assets/js/chart.js` — `value(d,dim)` nested accessor, `isFiltered(d)` predicate, `invertPoint(scale,px)` ordinal brush inversion, RAF-debounced brush updates, label-region drag for axis reorder.
- `../naiveasync/src/naiveasync/naiveasync.tsx` + `src/routes/tests.tsx` — render-prop children `(state, call) => JSX`, numbered live test scenarios page.
- `naivetable` (GitHub untra/naivetable) — `DataObj`, header inference from data, overridable default styles.

## Repo layout

```
naiveparallel/
  package.json  tsconfig.json  tsconfig.build.json
  vite.config.ts  vite.lib.config.ts  vitest.setup.ts
  eslint config  .prettierrc  .gitignore  .nvmrc  LICENSE (MIT)  README.md
  index.html                       # demo entry
  docs/superpowers/specs/2026-06-04-naiveparallel-design.md   # design doc (committed)
  src/
    naiveparallel/                 # THE PACKAGE (only thing published)
      index.ts                     # public barrel
      types.ts
      data/      inferAxes.ts accessors.ts stats.ts filter.ts deriveConfig.ts colorize.ts index.ts
      context/   NaiveParallelContext.ts NaiveParallelProvider.tsx reducer.ts useInteraction.ts
      components/
        NaiveParallel.tsx ParallelChart.tsx ParallelControl.tsx ParallelColumn.tsx ParallelRow.tsx
        chart/   AxisSvg.tsx LinesCanvas.tsx StatMarkers.tsx useBrush.ts useAxisDrag.ts scales.ts
        defaults/ DefaultControl.tsx DefaultChart.tsx
        styles.css                 # restylable class names + CSS vars
      hooks/    useNaiveParallel.ts
    demo/
      main.tsx App.tsx
      routes/  home.tsx tests.tsx scenarios/
      data/    mons.json typeColors.json types.json   # copied from ../parallel
  src/naiveparallel/**/*.test.ts(x)   # co-located tests
```

Note: repo is on `master`; create `main` as the PR base during scaffold.

## Type model (`src/naiveparallel/types.ts`)

```ts
export type DataObj = { [key: string]: any };
export type Path = string;                       // dot path, e.g. "stats.hp"
export type AxisKind = "numerical" | "ordinal";

interface AxisBase { id: string; path: Path; label: string; hidden: boolean; order: number; }

export interface NumericalAxis extends AxisBase {
  kind: "numerical";
  domain: [number, number];                      // min/max fit (brushable extent)
  allIntegers: boolean; allPositive: boolean;
}
export interface OrdinalAxis extends AxisBase {
  kind: "ordinal";
  values: string[];                              // low->high ordering
  cardinality: number;                           // unrenderable if > 64
  colors: Record<string, string>;                // per-value color by index
  source: "string" | "boolean" | "number";
  mapping?: (s: string) => string;               // value-space reducer; default s => s[0]
  renderable: boolean;
}
export type ParallelAxis = NumericalAxis | OrdinalAxis;

export interface NaiveParallelConfig {
  axes: ParallelAxis[];
  selectedAxisId: string | null;                 // ParallelColumn target
  colorizeAxisId: string | null;                 // null => follow selected
  colorizeMode: "follow" | "locked";
}

export interface NumericFilter { kind: "numeric"; min: number; max: number; }
export interface OrdinalFilter { kind: "ordinal"; enabled: Set<string>; }
export type FilterState = Record<string, AxisFilter | undefined>;

export interface NumericalStats { kind: "numerical"; max; mean; median; stddev; q1; q3; min; count; }
//  marker colors: Red=max, Green=mean, Blue=median, Yellow=±1σ band, Cyan=IQR bracket, Magenta=min
export interface OrdinalStats { kind: "ordinal"; mode: string; median: string | null; dispersion: number /*normalized entropy*/; counts; count; }
```

Context value (`NaiveParallelData<T>`): `data, axes, config, filters, filteredData, selectedStats, colorOf(row)` + updaters `setFilter, toggleOrdinalValue, addAxis, removeAxis, setAxisHidden, reorderAxes, selectAxis, setColorize`. Separate `NaiveParallelInteraction<T>`: `hoveredRow, selectedRow, setHovered, setSelected`.

## Data pipeline (pure, React-free, unit-tested first)

- `accessors.ts`: `pathAccessor(path)`; `discoverLeafPaths(row)` — recurse plain objects, emit dot-paths to scalar leaves (number/string/boolean), skip arrays/nulls; `detectType(values)`.
- `inferAxes.ts`: filter null rows → candidate paths (union over sample of rows) → per path: numerical (domain, allIntegers, allPositive) or ordinal (distinct values; if string cardinality > 64 apply provided `mapping` else default `s => s[0]`, recompute; still > 64 → `renderable: false`; sort values low→high; assign default palette colors by index). Then select the default "identity" first numerical axis into order [0] (drives default colorize).
- `stats.ts`: `numericalStats` (min/max/mean/median/σ/q1/q3 via d3-array `quantile`); `ordinalStats` (mode, median-if-orderable, Shannon entropy normalized by log(cardinality)).
- `filter.ts`: `makeFilterPredicate(axes, filters)` (numeric range pass, ordinal `enabled.has(v)`), `applyFilters`.
- `deriveConfig.ts`: full config from data when `configuration` prop absent.
- `colorize.ts`: numerical → `scaleSequential` over domain; ordinal → `axis.colors` lookup. (Pokémon type1→type2 gradients are demo-only styling, not core.)

## Context architecture (performance crux)

- **Two contexts**: `NaiveParallelDataContext` (stable: data/axes/config/filters/filteredData/stats/colorOf + updaters; changes only on commit) and `NaiveParallelInteractionContext` (hover/selection; isolates high-frequency re-renders).
- State via `useReducer` in `NaiveParallelProvider` (`reducer.ts` actions: SET_FILTER, TOGGLE_ORDINAL, ADD_AXIS, REMOVE_AXIS, SET_HIDDEN, REORDER, SELECT_AXIS, SET_COLORIZE). Derived values memoized.
- **In-flight gestures bypass React state**: brush/drag writes to refs and draws canvas imperatively via rAF (porting chart.js's RAF debounce); commit `setFilter`/`reorderAxes` on pointer-up only. `LinesCanvas` subscribes to commits (tiny emitter or `useSyncExternalStore`).
- Public hooks: `useNaiveParallel<T>()` (throws outside provider), `useNaiveParallelInteraction<T>()`.

## Components

- **`NaiveParallel<T>`**: `{ data, configuration?, children?, className?, style? }`. No children → `<DefaultControl/> + <DefaultChart/>`.
- **`ParallelControl`**: axis add/hide/remove/drag-reorder, selected-axis picker, colorize follow/locked toggle. Opinionated default UI, restylable via className/render overrides.
- **`ParallelChart`**: layered `<canvas>` (polylines in `colorOf(row)`, muted rows at low alpha) under React `<svg>` (one `AxisSvg` per visible axis + `StatMarkers`). Brushing via `useBrush` pointer events on the axis **track**; reorder via `useAxisDrag` on the **label region** (non-overlapping targets → no pointer conflicts). Ordinal brush uses ported `invertPoint` nearest-neighbor; ordinal values also individually toggleable. `StatMarkers` renders the 6 colored numeric markers (Red max / Green mean / Blue median / Yellow ±1σ band / Cyan IQR bracket / Magenta min) or 3 ordinal stats on the selected axis, recomputed live from `filteredData`.
- **`ParallelColumn`**: render-prop `children?: (stats, axis) => ReactNode`, default labeled list.
- **`ParallelRow`**: pure render-prop `children: ({ hoveredRow, selectedRow, filteredData, axes, stats }) => ReactNode` — the naiveasync `(state, call)` analogue.

Shared `scales.ts buildScale(axis, pixelRange)` consumed by both canvas and SVG layers (alignment guarantee); canvas ctx scaled by devicePixelRatio with logical coords equal to SVG.

## Demo site

HashRouter: `/` → home (overview + no-children default UI over mons.json) and `/test` → numbered live scenarios (naiveasync spirit): 1 default UI; 2 explicit compound children; 3 nested-leaf paths (`stats.hp`); 4 null-row guard + object skipping (`image.*`); 5 high-cardinality `name.en` → first-char fallback; 6 `type1` ordinal with typeColors + value toggling; 7 boolean→ordinal; 8 numeric brushing + live 6-color stats; 9 colorize follow vs locked; 10 axis add/hide/remove/reorder; 11 ParallelRow render-prop sprite card; 12 all-898-rows canvas perf.

## Build & publish

`package.json`: name `@untra/naiveparallel`, `type: module`, exports map (`types`/`import`/`require` + `./styles.css`), `files: ["dist"]`, peerDeps `react`/`react-dom >= 18`, deps `d3-scale ^4, d3-array ^3` (+`d3-shape ^3` if needed). Scripts: `dev`, `build` (lib via vite.lib.config.ts + vite-plugin-dts), `build:demo`, `test` (vitest), `lint`, `typecheck`, `prepublishOnly`, `deploy` (gh-pages, demo build to `dist-demo`).

## Implementation phases (each independently verifiable)

- **Phase 0 — Scaffold**: `main` branch; all configs; empty package barrel; demo hello-world; commit design doc to `docs/superpowers/specs/2026-06-04-naiveparallel-design.md`. Verify: `npm run dev`, `npm run test`, `npm run build` all succeed.
- **Phase 1 — Types + pure data pipeline** with full unit tests against mons.json-derived fixtures. Verify: `npm run test` green; no React imports in `data/`.
- **Phase 2 — Context**: provider/reducer/split contexts/subscribe channel + `useNaiveParallel`. Verify: component tests green; hook throws outside provider.
- **Phase 3 — Basic chart**: `NaiveParallel` + default-UI fallback + `ParallelChart` SVG axes + canvas lines (static). Verify: demo `/` renders 898 Pokémon polylines.
- **Phase 4 — Interaction + stats + demo**: `useBrush`, `useAxisDrag`, `StatMarkers`, `ParallelControl`, `ParallelColumn`, `ParallelRow`, `/test` scenarios 1–12. Verify: brushing filters & live stats work; default UI from `data` alone.

Later passes (out of scope now): theming surface, reorder animations, typedoc, gh-pages deploy, touch support.

## Testing strategy

- Unit (no React): inferAxes (nested leaves, null rows, >64 + first-char fallback, integer/positive, domains), stats (fixture-verified mean/median/σ/IQR; mode/median/entropy), filter predicates, colorize.
- Component (@testing-library/react): context wiring, default-UI fallback, render-prop fields, filter-commit → filteredData/stats updates.
- Not tested initially: canvas pixels, gesture pixel math (covered via pure scale/invert unit tests). Stub `canvas.getContext` in vitest.setup.ts.

## Open risks (with stance)

1. Canvas/SVG alignment → single shared `buildScale` + margins constant; dpr-scale the canvas context.
2. Brush vs drag pointer conflict → geometric separation (label = drag, track = brush); touch deferred.
3. React 18 vs 19 typings → peer `>=18`, dev on 18 types, avoid React.FC pitfalls.
4. Leaf discovery scope → `image.*` URL-like / still->64-after-mapping paths become `renderable: false`, hidden by default but addable; tested, configurable rule.
5. Numeric-as-ordinal ambiguity (`generation`) → default numerical; control allows recasting low-distinct numerics as ordinal.
