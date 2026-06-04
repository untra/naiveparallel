import React, { useMemo } from "react";
import {
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

export function Tests() {
  const dualData = useMemo(
    () => sample.map((m) => ({ id: m.id, hp: m.stats.hp, speed: m.stats.speed, dualType: m.type1 !== m.type2 })),
    []
  );

  return (
    <main style={{ padding: "1rem" }}>
      <h1>Test scenarios</h1>
      <p>
        Numbered live scenarios, in the spirit of{" "}
        <a href="https://naiveasync.untra.io/#/test">naiveasync's test page</a>. Each demonstrates
        one capability of the compound component.
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
        title="Ordinal colors and value toggling"
        note="type1/type2 get the canonical Pokémon type colors via inference overrides; lock colorizing to type1 in the control, and click ordinal tick labels on the axis to toggle individual values."
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
        title="Boolean → ordinal"
        note="A derived dualType boolean becomes a two-value ordinal axis (false / true), orderable and toggleable like any other ordinal."
      >
        <NaiveParallel data={dualData} />
      </Scenario>

      <Scenario
        n={8}
        title="Brushing and live statistics"
        note="Select an axis by clicking its name, then drag along any numerical axis to brush a range. The six color-coded stats — red max, green mean, blue median, yellow ±1σ band, cyan IQR bracket, magenta min — recompute over the filtered rows as you brush. Click a brushed axis to clear it."
      >
        <NaiveParallel data={sample}>
          <ParallelColumn />
          <ParallelChart />
        </NaiveParallel>
      </Scenario>

      <Scenario
        n={9}
        title="Colorize: follow vs locked"
        note="By default row colors follow the selected axis (blue→red ramp for numerical, value colors for ordinal). Use the control's colorize dropdown to lock colors to one axis while selecting others."
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
    </main>
  );
}
