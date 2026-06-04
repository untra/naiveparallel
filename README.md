# 🪒 naiveparallel

> Naive React parallel coordinates plot for `Array<T>` datasets.

`@untra/naiveparallel` is a compound React component for rendering highly-interactive
[parallel coordinates plots](https://en.wikipedia.org/wiki/Parallel_coordinates) from
arbitrary arrays of objects — the same input shape
[`@untra/naivetable`](https://github.com/untra/naivetable) accepts. Where naivetable
renders the raw data row by row, naiveparallel renders the parallel coordinates plot
(and more).

```tsx
import { NaiveParallel } from "@untra/naiveparallel";
import "@untra/naiveparallel/styles.css";

// the whole default UI from data alone:
<NaiveParallel data={data} />

// or compose the compound components and style them yourself:
<NaiveParallel data={data} configuration={config}>
  <ParallelControl />
  <ParallelColumn />
  <ParallelChart />
  <ParallelRow>{({ hoveredRow, selectedRow, filteredData }) => /* your UI */}</ParallelRow>
</NaiveParallel>
```

## Design

- **`NaiveParallel`** ingests `data: T[]`, infers **axes** from the data columns
  (numbers → numerical, strings/booleans → ordinal), and provides all derived state via
  React Context to its compound children.
- **`ParallelChart`** renders SVG axes / brushes / stat markers over a canvas line layer
  for large-volume performance. Numerical axes are brushable to ranges; ordinal axis
  values are individually toggleable. Ordinal axes cap at 64 distinct values (string
  spaces reduce via a configurable mapping, defaulting to first-character).
- **`ParallelControl`** adds / hides / removes / reorders axes and manages row
  colorizing (follow the selected axis, or lock to a chosen one).
- **`ParallelColumn`** reports live statistics for the selected axis over the filtered
  data — numerical: max <span style="color:red">red</span>, mean green, median blue,
  ±1σ band yellow, IQR cyan, min magenta; ordinal: mode, median, dispersion (entropy).
- **`ParallelRow`** is a pure render-prop exposing `hoveredRow` / `selectedRow` /
  `filteredData` for free-form styling, in the spirit of
  [naiveasync](https://github.com/untra/naiveasync)'s `(state, call) => JSX`.

See `docs/superpowers/specs/` for the full design document.

## Development

```sh
npm install
npm run dev        # demo site (home + /test scenarios)
npm run test       # vitest
npm run typecheck
npm run lint
npm run build      # library -> dist/ (ESM + CJS + types)
npm run build:demo # demo site -> dist-demo/
```

## License

MIT © Samuel Volin
