# NaiveParallel — Interaction Hints (ambient discoverability) — Design Spec

**Date:** 2026-06-18 · **Status:** approved design, awaiting implementation cycle

> This is a research/ideation deliverable. **No library code is written as part of this spec.** It
> describes a feature — an opt-in `hints` prop adding three ambient, self-decaying interaction nudges —
> for a future implementation cycle.

---

## Context

A parallel-coordinates plot reads as a static "hairball" on first encounter. Every interaction
NaiveParallel supports is *latent* — revealed only by a cursor change once the pointer already sits on
the right pixel. A first-time user has no reason to put their pointer on an axis track, label, or line,
so the chart's whole value (filter by brushing, inspect by hovering) goes undiscovered.

An affordance audit confirmed the mechanics are solid but discoverability scaffolding is absent: no
tooltips, no legend, no onboarding, no row labels, no motion. This spec adds **three ambient,
self-decaying hints** that convert the two highest-value/least-discoverable gestures — **brushing a
track** and **reading a row** — into visible invitations, without violating the library's deliberately
minimal, un-opinionated design ethos.

### Decisions locked with the user
- **Intrusiveness:** ambient & self-decaying only. No coach overlay, no persistent help chrome.
- **Default:** **off by default**, opt-in via a single `hints` prop (library stays inert unless asked).
- **Priority interactions:** brushing + row hover/read only.
- **Scope, final:** exactly three features — Ghost-brush demo, Live filter counter, Hover readout tooltip.
- **Decay persistence:** **per-mount** (resets every mount; no localStorage, no cross-session memory).
- **Hover tooltip in vertical layout:** **disabled** (vertical/mobile layout suppresses the tooltip).
- **Shared "tasteful noticing" motif:** a **font-weight pulse** — text swells in weight on change while
  brushing, then eases back to normal weight. Used by the counter numerator in v1; defined as a reusable
  primitive so future textual readouts (e.g. a v2 stat legend) can adopt it.

### Non-goals
- No grab-handles on brushes, no idle line-pulse, no axis reorder/select hints, no stat legend (all parked → v2 parking lot).
- No new data-context fields; nothing that re-renders data consumers on hover.
- No always-on chrome — every hint lives behind the `hints` flag.

---

## API surface

Add `hints?: boolean` (default `false`):
- On `NaiveParallelProps` (`src/naiveparallel/components/NaiveParallel.tsx:9-32`) — passes through to the default `ParallelChart`.
- On `ParallelChartProps` (`src/naiveparallel/components/ParallelChart.tsx:46-67`) — threaded into the internal `ChartLayers` component, which is where overlays mount.

When `false` (default) **nothing about current behavior changes** — no new DOM, no listeners, no timers.
When `true`, the three features below activate. A single boolean keeps the public surface minimal; if it
later needs sub-toggles it can widen to `hints?: boolean | { ghostBrush?; counter?; tooltip? }` without a
breaking change.

---

## State model — per-mount decay

Hints decay by observing whether the user has performed the real gesture. These flags are **interaction-tier
state**, never committed/data state — they must not re-render data consumers (the two-context split at
`NaiveParallelProvider.tsx:148-151` is load-bearing here).

- Store as `useRef`/`useState` local to the overlay layer (`ChartLayers`) or a small dedicated
  `useHintState()` hook — **not** in `reducer.ts` (which is committed state only) and **not** in
  `NaiveParallelInteraction` (keep that context lean).
- Flags: `hasBrushed: boolean`, `hasHovered: boolean`. Both start `false`, flip `true` on first
  corresponding real gesture, never reset within a mount.
- Detection sources (read-only observation, no new actions):
  - `hasBrushed` ← first time any axis filter commits. Observe `config` filters / the `SET_FILTER`
    path used by `useBrush.ts` (brushing also sets `selectedAxisId`, `useBrush.ts:157`).
  - `hasHovered` ← first time `hoveredRow` (`NaiveParallelProvider.tsx:146`) goes non-null.

---

## Feature 1 — Ghost-brush demo (teaches the brush gesture)

**What:** After ~1.5s idle on mount, the **active axis** track plays a one-shot, translucent brush that
grows from a point to ~30–40% of the track then releases — a literal demonstration of the drag-to-filter
gesture. Repeats at most twice with a few-seconds gap, then rests. **Permanently stops once `hasBrushed`
flips.**

**Where it renders:** a non-interactive (`pointer-events: none`) SVG `rect`/`path` inside the chart's
`<svg>` layer in `ChartLayers` (`ParallelChart.tsx` `ChartLayers()`), or an absolutely-positioned overlay
sibling — must sit **above** `LinesCanvas`/`HoverCanvas` but never intercept pointer events.

**Positioning:** entirely through the shared scale so it stays pixel-aligned with canvas + SVG:
- active axis cross-axis position: `layout.axisPos(selectedAxis.id)` (`ChartLayoutContext.ts`).
- animate the brush extent along the value direction using `layout.valueExtent()` for the track span.
- **Layout-aware:** in `horizontal` orientation the demo rect grows along Y (vertical track); in
  `vertical` orientation it grows along X (horizontal track). Read `layout.orientation`
  (`ChartLayout.orientation`, `"horizontal" | "vertical"`).

**Active axis:** `selectedAxis` / `config.selectedAxisId` (`types.ts:242`, `NaiveParallelProvider.tsx:56-58`).
If no axis is selected, demo targets the first visible axis (`layout.visibleAxes[0]`).

**Animation:** follow the existing rAF discipline — `useRef<number | null>` + `requestAnimationFrame` +
`cancelAnimationFrame` cleanup, exactly as `useBrush.ts:139-151` / `useRowHover.ts:69-86`. The demo only
mutates local overlay state per frame; it must **never** dispatch `SET_FILTER` or touch data state.

**Idle timer:** a `setTimeout`/rAF clock that resets on any pointer activity over the chart; demo fires
only after the idle threshold and only while `!hasBrushed`. Cleared on unmount.

**Accessibility/safety:** gate the motion behind `prefers-reduced-motion` (skip animation, optionally show
a single static faint brush hint instead) so the demo is inert for motion-sensitive users.

---

## Feature 2 — Live filter counter (the brush payoff)

**What:** A small readout near the active axis showing `filteredData.length / data.length`
(e.g. `247 / 3,000`). Visible while brushing and while **any** filter is active; hidden when no filter is
applied (so it doesn't add noise to an unfiltered chart). This is the *reward* that makes the brush gesture
legibly worthwhile.

**Data source:** `useNaiveParallel()` → `filteredData.length` (numerator) and `data.length`
(denominator) — already memoized at `NaiveParallelProvider.tsx:51-54`, exact fields `types.ts:234,240`.
No new derivation needed.

**Placement:** absolutely-positioned `div` in `ChartLayers`, anchored to the active axis via
`layout.axisPos(selectedAxis.id)` near the value-axis start; layout-aware offset so it doesn't collide
with the axis label (top in horizontal, leading edge in vertical).

**Font-weight pulse motif (shared "tasteful noticing"):**
- The **numerator** is the focus: on each change while brushing, its `font-weight` swells (e.g. 400→700)
  then **eases back** to normal over ~150–250ms, drawing the eye to the changing number.
- Implemented as a small reusable primitive (e.g. a `usePulseWeight(value)` hook or a `PulseText`
  component) so future readouts can reuse it. v1 consumer = the counter numerator only.
- Honors `prefers-reduced-motion` (no weight animation; final weight only).

---

## Feature 3 — Hover readout tooltip (teaches "rows are records")

**What:** On row hover, a small tooltip showing the row's **identity** (the identity/first-axis value — its
"name") plus its per-axis values. Today hover only thickens a polyline with zero textual feedback; this
makes the hovered line legible as a specific record.

**Data source:** `hoveredRow` from `useNaiveParallelInteraction()`
(`context/NaiveParallelContext.ts:25-31`, type `NaiveParallelInteraction` `types.ts:265-270`). Identity
axis = `axes[0]` per the inference rule; per-axis values via the existing dot-path accessors. Reads only
interaction context → no data-consumer re-render.

**Placement:** absolutely-positioned `div` in `ChartLayers`, following the pointer (offset to avoid
occluding the line), clamped within the chart bounds (`layout.width`/`layout.height`).

**Layout gate (locked):** **only rendered in `horizontal` orientation.** When `layout.orientation ===
"vertical"` the tooltip is **disabled** (vertical/mobile layout has tighter space and higher
pointer-occlusion risk; hover still thickens the line, just no tooltip).

**Decay:** the tooltip itself is the reward and stays available; `hasHovered` is tracked for symmetry and
potential future "you've discovered hover" suppression of any hover *hint* (none ships in v1), not to
suppress the tooltip.

---

## Integration points (reference — all read-only confirmed)

| Concern | Location | Symbol |
| --- | --- | --- |
| Interaction context/hook | `context/NaiveParallelContext.ts:25`, `types.ts:265-270` | `useNaiveParallelInteraction()`, `hoveredRow`, `selectedRow` |
| Hover/select state (separate from reducer) | `context/NaiveParallelProvider.tsx:146-147` | `useState` |
| Row counts | `types.ts:234,240`, `NaiveParallelProvider.tsx:51-54` | `data`, `filteredData` |
| Layout orientation | `components/chart/ChartLayoutContext.ts`, `chart/scales.ts:5` | `layout.orientation` |
| Scale/positioning | `ChartLayoutContext.ts` | `axisPos()`, `scaleOf()`, `project()`, `valueExtent()` |
| Active axis | `types.ts:242`, `NaiveParallelProvider.tsx:56-58` | `selectedAxis`, `selectedAxisId` |
| Overlay mount point | `components/ParallelChart.tsx` (`ChartLayers()`) | sibling to `LinesCanvas`/`HoverCanvas`/`<svg>` |
| Prop threading | `NaiveParallel.tsx:9-32`, `ParallelChart.tsx:46-67` | new `hints?: boolean` |
| rAF pattern | `chart/useBrush.ts:139-151`, `chart/useRowHover.ts:69-86` | `requestAnimationFrame` + cleanup |

---

## Layout behavior matrix

| Feature | Horizontal | Vertical (mobile) |
| --- | --- | --- |
| Ghost-brush demo | brush grows along Y on active vertical track | brush grows along X on active horizontal track |
| Live filter counter | anchored near top of active axis | anchored near leading edge of active axis |
| Hover tooltip | **enabled** | **disabled** |

All three respect `prefers-reduced-motion` (skip/instant where motion applies).

---

## Demo integration (when implemented)

Add a numbered `<Scenario>` to `src/demo/routes/tests.tsx` demonstrating `hints` (one capability per
scenario, per existing convention). Optionally enable `hints` on a gallery dataset that benefits most
(e.g. the 3,000-row otc-stocks preset, where the counter payoff is vivid).

---

## Verification (when implemented)

- **Unit/interaction (vitest, jsdom 800×480 fixture):**
  - `hints={false}` (default) renders zero hint DOM and registers no timers/listeners.
  - Ghost-brush demo element appears after idle threshold and disappears once a filter commits (`hasBrushed`).
  - Counter shows `filteredData.length / data.length`, hidden with no active filter, updates on `SET_FILTER`.
  - Tooltip renders on `hoveredRow` set in horizontal layout; **absent** in vertical layout.
  - Decay flags are per-mount: remounting restores the initial hint behavior.
- **Real-browser (playwright-core / cached Chrome):** visually confirm ghost-brush motion, counter
  font-weight pulse easing, tooltip placement/clamping; confirm reduced-motion path.
- **`npm run ci`** (typecheck + lint + test + build) green before declaring done.

---

## Deferred — v2 parking lot
- Grab-handles + move-grip on committed brushes (teaches resize/slide-vs-clear).
- Pinned-row chip with explicit clear.
- Axis-label dual affordance (drag-grip glyph, `grab` cursor) + first-run reorder wink.
- Stat-marker legend / on-marker labels — first reuse target for the font-weight-pulse motif.
- Cross-session decay memory (localStorage), if ever wanted.
- Hover tooltip variant suitable for vertical layout.

---

## Appendix — ideation considered and cut

The brainstorm produced 12 candidate nudges across brush / axis-label / row-hover / stat-marker /
ambient categories. After choosing *ambient & self-decaying*, *opt-in*, and *brushing + row-reading*
priority, the set narrowed to the three above. Cut from v1 (rationale in parentheses):
ghost-brush is the chosen brush teacher, so grab-handles (#3, advanced sub-gesture) and idle line-pulse
(#10, reads as a render glitch on dense charts) were dropped; track-rail affordance (#2) and live-counter
were merged/kept respectively; axis-label affordances + reorder wink (#5–7), stat legend (#11), and the
dismissible coach overlay (#12, too opinionated for the minimal ethos) were parked for v2.
