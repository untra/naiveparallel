import React, { useMemo } from "react";
import {
  deriveConfig,
  NaiveParallel,
  ParallelChart,
  ParallelColumn,
  ParallelControl,
  ParallelRow,
} from "../../naiveparallel";
import "../../naiveparallel/components/styles.css";
import mons from "../data/mons.json";
import typeColors from "../data/typeColors.json";

const rows = (mons as any[]).filter((m) => m != null);
const sample = rows.slice(0, 151); // gen 1 — keeps the page snappy with many charts

function Scenario(props: { n: number; title: string; children: React.ReactNode; note?: string }) {
  return (
    <section style={{ borderTop: "1px solid #ccc", padding: "1rem 0", marginTop: "1rem" }}>
      <h2>
        {props.n}. {props.title}
      </h2>
      {props.note && <p style={{ maxWidth: "72ch" }}>{props.note}</p>}
      {props.children}
    </section>
  );
}

/** A button-driven layout toggle, demonstrating horizontal/vertical/auto. */
function LayoutToggle({ data }: { data: Record<string, unknown>[] }) {
  const [layout, setLayout] = React.useState<"auto" | "horizontal" | "vertical">("auto");
  const options = ["auto", "horizontal", "vertical"] as const;
  return (
    <>
      <div role="group" aria-label="layout" style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={layout === o}
            onClick={() => setLayout(o)}
            style={{ fontWeight: layout === o ? 700 : 400, cursor: "pointer" }}
          >
            {o}
          </button>
        ))}
      </div>
      <NaiveParallel data={data} layout={layout} />
    </>
  );
}

export function Tests() {
  const dualData = useMemo(
    () => sample.map((m) => ({ id: m.id, hp: m.stats.hp, speed: m.stats.speed, dualType: m.type1 !== m.type2 })),
    []
  );

  const layoutData = useMemo(
    () =>
      sample.map((m) => ({
        id: m.id,
        hp: m.stats.hp,
        attack: m.stats.attack,
        defense: m.stats.defense,
        speed: m.stats.speed,
        type1: m.type1,
      })),
    []
  );

  const rgbData = useMemo(
    () =>
      sample.map((m) => ({
        id: m.id,
        attack: m.stats.attack,
        defense: m.stats.defense,
        speed: m.stats.speed,
        type1: m.type1,
      })),
    []
  );
  const rgbConfig = useMemo(() => {
    const derived = deriveConfig(rgbData);
    return {
      ...derived,
      // stat channels first so they drive R/G/B; the id axis follows
      axes: [...derived.axes.filter((a) => a.id !== "id"), ...derived.axes.filter((a) => a.id === "id")],
      colorizeMode: "components" as const,
    };
  }, [rgbData]);

  const divergingData = useMemo(
    () =>
      sample.map((m) => ({
        id: m.id,
        // attack minus defense crosses zero naturally: glass cannons positive, walls negative
        delta: m.stats.attack - m.stats.defense,
        hp: m.stats.hp,
        speed: m.stats.speed,
      })),
    []
  );
  const divergingConfig = useMemo(() => {
    const derived = deriveConfig(divergingData);
    return { ...derived, colorizeAxisId: "delta", colorizeMode: "locked" as const };
  }, [divergingData]);

  const statsConfig = useMemo(() => {
    const derived = deriveConfig(dualData);
    return {
      ...derived,
      selectedAxisId: "hp",
      // chart-level: recolor max/min, hide mean and the ±1σ lines, keep median/IQR default
      statMarkers: {
        enabled: true,
        colors: { max: "#e0245e", min: "#1d9bf0", mean: false as const, stddev: false as const },
      },
    };
  }, [dualData]);

  const distinguishConfig = useMemo(
    () => ({ ...deriveConfig(dualData), colorizeMode: "distinguish" as const }),
    [dualData]
  );

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Test scenarios</h1>
      <p>
        Numbered live scenarios. Each demonstrates one capability of the compound component.
      </p>

      <Scenario
        n={1}
        title="Full default UI from data alone"
        note="<NaiveParallel data={mons} /> with no children renders the chart and control with axes inferred from the data columns."
      >
        <NaiveParallel data={sample} />
      </Scenario>

      <Scenario
        n={2}
        title="Explicit compound children"
        note="The same data composed manually: ParallelControl, ParallelColumn, ParallelChart, and a ParallelRow render-prop, all sharing one context."
      >
        <NaiveParallel data={sample}>
          <ParallelControl />
          <ParallelColumn />
          <ParallelChart height={360} />
          <ParallelRow>
            {({ hoveredRow, filteredData }) => (
              <p>
                hovering: <strong>{hoveredRow ? hoveredRow.name.en : "—"}</strong> ·{" "}
                {filteredData.length} rows pass the filters
              </p>
            )}
          </ParallelRow>
        </NaiveParallel>
      </Scenario>

      <Scenario
        n={3}
        title="Nested leaf paths"
        note="Axes collect values through dot-paths (stats.hp, stats.attack, name.en) discovered by recursing the row objects — flat Object.keys would only see nested objects."
      >
        <NaiveParallel data={sample.map((m) => ({ id: m.id, stats: m.stats }))} />
      </Scenario>

      <Scenario
        n={4}
        title="Null-row guard and URL skipping"
        note="The raw mons.json array literally starts with a null entry, and image.* values are URLs (898 distinct) — null rows are skipped, URL-like axes are inferred but hidden as unrenderable (visible in the control, unchecked and disabled)."
      >
        <NaiveParallel data={(mons as any[]).slice(0, 152)} />
      </Scenario>

      <Scenario
        n={5}
        title="High-cardinality ordinal fallback"
        note="name.en has 898 unique values — far beyond the 64-value ordinal cap — so the axis falls back to the first-character mapping f(s) => s[0]."
      >
        <NaiveParallel data={rows.map((m) => ({ id: m.id, name: { en: m.name.en }, hp: m.stats.hp }))} />
      </Scenario>

      <Scenario
        n={6}
        title="Ordinal colors and range brushing"
        note="type1/type2 get the canonical Pokémon type colors via inference overrides; lock colorizing to type1 in the control, and drag along an ordinal axis to brush a contiguous range of values (the brush snaps to whole values; grab the band to slide it, click an empty track to clear)."
      >
        <NaiveParallel
          data={sample}
          inferOptions={{
            overrides: {
              type1: { colors: typeColors as Record<string, string> },
              type2: { colors: typeColors as Record<string, string> },
            },
          }}
        />
      </Scenario>

      <Scenario
        n={7}
        title="Boolean -> ordinal"
        note="A derived dualType boolean becomes a two-value ordinal axis (false / true), orderable and brushable like any other ordinal."
      >
        <NaiveParallel data={dualData} />
      </Scenario>

      <Scenario
        n={8}
        title="Brushing and live statistics"
        note="Drag along any numerical axis to brush a range — the rows and stats update live while you drag, and the brushed axis becomes the active (selected) one. Grab the brushed range itself to slide it along the axis, size preserved. Several axes can be brushed at once; clicking an empty part of a brushed track clears that axis. Markers: red max and blue min (half thickness), green median, cyan mean, yellow IQR bracket, magenta dotted ±1σ around the median."
      >
        <NaiveParallel data={sample}>
          <ParallelColumn />
          <ParallelChart />
        </NaiveParallel>
      </Scenario>

      <Scenario
        n={9}
        title="Colorize: follow vs locked"
        note="By default row colors follow the selected axis. Each numerical axis sweeps between its own complementary bright color pair; an axis whose domain crosses zero diverges red (negative) -> yellow (zero) -> green (positive); temporal axes ramp blue (early) -> red (late); ordinal axes use their value colors. Use the control's colorize dropdown to lock colors to one axis while selecting others."
      >
        <NaiveParallel data={sample} />
      </Scenario>

      <Scenario
        n={10}
        title="Axis management"
        note="From the control: hide axes with the checkbox, remove them with ×, reorder with ↑/↓ (or drag the axis name on the chart), and re-add removed paths from the add-axis dropdown."
      >
        <NaiveParallel data={sample} />
      </Scenario>

      <Scenario
        n={11}
        title="ParallelRow render-prop"
        note="ParallelRow exposes hoveredRow / selectedRow / filteredData for free-form rendering — here, a sprite card. Hover a line on the chart; click to pin it."
      >
        <NaiveParallel data={sample}>
          <ParallelChart height={320} />
          <ParallelRow>
            {({ hoveredRow, selectedRow, setSelected }) => {
              const row = hoveredRow ?? selectedRow;
              return (
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", minHeight: 96 }}>
                  {row ? (
                    <>
                      <img src={row.image.sprite} alt={row.name.en} width={96} height={96} />
                      <div>
                        <strong>{row.name.en}</strong> #{row.id}
                        <br />
                        {row.type1}
                        {row.type2 !== row.type1 ? ` / ${row.type2}` : ""} · gen {row.generation}
                        {selectedRow && (
                          <>
                            {" "}
                            <button onClick={() => setSelected(null)}>unpin</button>
                          </>
                        )}
                      </div>
                    </>
                  ) : (
                    <em>hover a line…</em>
                  )}
                </div>
              );
            }}
          </ParallelRow>
        </NaiveParallel>
      </Scenario>

      <Scenario
        n={12}
        title="Large volume: all 898 rows"
        note="The full Pokédex on the canvas line layer — brushing, hovering, and stats stay responsive because polylines render to canvas and React only re-renders on commit."
      >
        <NaiveParallel
          data={rows}
          inferOptions={{
            overrides: {
              type1: { colors: typeColors as Record<string, string> },
              type2: { colors: typeColors as Record<string, string> },
            },
          }}
        />
      </Scenario>

      <Scenario
        n={13}
        title="Explicit axis ranges"
        note="The six stat axes share a fixed [0, 255] domain via configuration overrides — the conventional Pokémon stat ceiling — instead of fitting each axis to its own data extent, so their shapes are directly comparable. Values beyond a configured range clamp to the axis ends."
      >
        <NaiveParallel
          data={sample}
          inferOptions={{
            overrides: {
              "stats.hp": { domain: [0, 255] },
              "stats.attack": { domain: [0, 255] },
              "stats.defense": { domain: [0, 255] },
              "stats.spAttack": { domain: [0, 255] },
              "stats.spDefense": { domain: [0, 255] },
              "stats.speed": { domain: [0, 255] },
            },
          }}
        />
      </Scenario>

      <Scenario
        n={14}
        title="Temporal (date) axis"
        note="A string column of ISO dates auto-detects as a temporal axis: it brushes, filters, and reports stats exactly like a numerical axis, but renders date ticks and date-formatted stats (the control marks it 'cal'). M/D/YYYY and month-name columns auto-detect too; numeric epoch columns never do — force those with inferOptions overrides { kind: 'temporal' }."
      >
        <NaiveParallel
          data={[
            { id: 1, released: "2024-01-15", price: 19.99 },
            { id: 2, released: "2024-03-02", price: 24.5 },
            { id: 3, released: "2024-06-21", price: 12.0 },
            { id: 4, released: "2024-09-10", price: 30.0 },
            { id: 5, released: "2024-12-25", price: 8.75 },
          ]}
        >
          <ParallelChart />
          <ParallelColumn />
          <ParallelControl />
        </NaiveParallel>
      </Scenario>

      <Scenario
        n={15}
        title="Colorize: RGB color components"
        note="Pick 'color components' in the colorize dropdown: the first three numerical axes become the R, G, and B channels, so each row's color encodes its placement on all three at once (low on everything -> black, high on everything -> white). Reorder the axes (↑/↓ or drag) to remap which axes drive which channel."
      >
        <NaiveParallel data={rgbData} configuration={rgbConfig} />
      </Scenario>

      <Scenario
        n={16}
        title="Colorize: diverging at zero"
        note="Colorizing is locked to delta (attack - defense), whose domain crosses zero: rows diverge red (most negative) -> yellow (exactly zero) -> green (most positive), with the yellow pivot anchored at value 0 — not the domain midpoint. An all-negative axis spans only the red->orange segment: yellow strictly means zero."
      >
        <NaiveParallel data={divergingData} configuration={divergingConfig} />
      </Scenario>

      <Scenario
        n={17}
        title="Vertical / mobile layout"
        note="Toggle the layout direction. Horizontal draws axes as vertical columns (desktop); vertical stacks them as horizontal lines top-to-bottom with rows running left-to-right (low-left, high-right), deriving its height from the axis count so it scrolls on mobile. 'auto' picks vertical on a portrait viewport — narrow your window or rotate a device to see it switch. Brushing, hover, reorder and stat markers all work in both orientations."
      >
        <LayoutToggle data={layoutData} />
      </Scenario>

      <Scenario
        n={18}
        title="Ambient interaction hints (opt-in)"
        note="Pass hints to surface the two highest-value gestures. After a brief idle the active axis plays a translucent ghost-brush demonstrating drag-to-filter (it stops for good once you brush). Brushing reveals a live kept/total counter whose numerator swells then eases on each change. Hovering a line shows a readout tooltip naming the row and its per-axis values (horizontal layout only). Off by default; all three respect prefers-reduced-motion."
      >
        <NaiveParallel data={layoutData} hints />
      </Scenario>

      <Scenario
        n={19}
        title="Stat markers: customizable & optional (chart-level)"
        note="The selected axis' stat markers are a chart-level setting, not an axis one. Here the hp axis recolors its max (custom red) and min (custom blue) and hides mean and the ±1σ lines entirely, leaving the green median and yellow IQR in their default shades. Set statMarkers.enabled to false to drop them all — for viewers who don't want the statistical detail. Each stat key (max/min/median/mean/iqr/stddev; mode/median/dispersion for ordinals) takes a custom color or false to hide."
      >
        <NaiveParallel data={dualData} configuration={statsConfig} />
      </Scenario>

      <Scenario
        n={20}
        title="Colorize: distinguish (unique per-row debug color)"
        note="The 'distinguish' colorize mode gives every row a unique, stable color from one column — the selected axis (here the identity id), or a colorizeLock'd one. Three decorrelated HSV channels read as distribution diagnostics: Hue = the value's rank, swept red→magenta so adjacent rows still differ; Saturation = signed z-score from the mean (kept high so rows stay vivid, above-mean a touch more saturated); Brightness = folded deviation from the median scaled by IQR (median rows dimmer, outliers brightest). Saturation stays high so no row looks washed-out/deselected. Colors are computed over the full dataset, so a row keeps its color as you brush. Switch the control's colorize dropdown to 'distinguish rows' on any dataset to try it."
      >
        <NaiveParallel data={dualData} configuration={distinguishConfig} />
      </Scenario>
    </main>
  );
}
