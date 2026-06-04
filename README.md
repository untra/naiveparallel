# 🪒 naiveparallel

[![npm](https://img.shields.io/npm/v/%40untra%2Fnaiveparallel?logo=npm&color=cb3837)](https://www.npmjs.com/package/@untra/naiveparallel)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

> Naive React parallel coordinates plot for `Array<T>` datasets.

[`@untra/naiveparallel`](https://www.npmjs.com/package/@untra/naiveparallel) is a compound React component for rendering highly-interactive
[parallel coordinates plots](https://en.wikipedia.org/wiki/Parallel_coordinates) from
arbitrary arrays of objects — the same input shape
[`@untra/naivetable`](https://github.com/untra/naivetable) accepts. Where naivetable
renders the raw data row by row, naiveparallel renders the parallel coordinates plot
(and more).

```sh
npm install @untra/naiveparallel
```

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
  for large-volume performance. Numerical axes are brushable to ranges; ordinal axes
  are brushable to a contiguous run of values in their sort order (the brush snaps to
  whole value bands). Ordinal axes cap at 64 distinct values (string
  spaces reduce via a configurable mapping, defaulting to first-character).
- **`ParallelControl`** adds / hides / removes / reorders axes and manages row
  colorizing (follow the selected axis, or lock to a chosen one).
- **`ParallelColumn`** reports live statistics for the selected axis over the filtered
  data — numerical: max red / min blue (half thickness), median green, mean cyan,
  IQR bracket yellow, median±1σ magenta dotted; ordinal: mode, median, dispersion (entropy).
- **`ParallelRow`** is a pure render-prop exposing `hoveredRow` / `selectedRow` / filteredData` for free-form styling.

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

## Deployment

The demo site auto-deploys to [naiveparallel.untra.io](https://naiveparallel.untra.io)
via GitHub Pages on every push to `main` (`.github/workflows/pages.yml`). The custom
domain is set by `public/CNAME` plus the repo's Pages settings.

## Publishing

To release `@untra/naiveparallel` to npm:

```sh
npm login                  # as the @untra scope owner
npm pack --dry-run         # inspect tarball: dist/naiveparallel.{js,cjs,css} + index.d.ts
git add -A && git commit   # npm version requires a clean working tree
npm version patch          # or minor / major — bumps version + creates a git tag
npm publish                # prepublishOnly runs the full ci gate first
git push --follow-tags
```

(`npm version --no-git-tag-version patch` bumps without the commit/tag, if needed.)

Consumers then:

```ts
import { NaiveParallel } from "@untra/naiveparallel";
import "@untra/naiveparallel/styles.css";
```

## License

MIT © Samuel Volin
