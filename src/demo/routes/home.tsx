import { useEffect, useRef, useState } from "react";
import {
  NaiveParallel,
  ParallelChart,
  ParallelColumn,
  ParallelControl,
  ParallelRow,
  type DataObj,
  type NaiveParallelConfig,
} from "../../naiveparallel";
import "../../naiveparallel/components/styles.css";
import { DEMO_DATASETS, parseUpload, type DemoDataset } from "../datasets";

interface LoadedDataset {
  /** The registry entry, or null for a custom upload. */
  dataset: DemoDataset | null;
  /** Unique key: dataset id or upload filename — forces a clean remount. */
  key: string;
  title: string;
  rows: DataObj[];
  config: NaiveParallelConfig | undefined;
}

const GITHUB_DATASETS_BASE =
  "https://github.com/untra/naiveparallel/blob/main/src/demo/datasets/";

const USAGE_SNIPPET = `npm install @untra/naiveparallel

import { NaiveParallel } from "@untra/naiveparallel";
import "@untra/naiveparallel/styles.css";

<NaiveParallel data={data} />`;

export function Home() {
  const [loaded, setLoaded] = useState<LoadedDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (dataset: DemoDataset) => {
    if (dataset.disabled || !dataset.load) return;
    setError(null);
    setLoading(dataset.id);
    try {
      const rows = await dataset.load();
      setLoaded({
        dataset,
        key: dataset.id,
        title: dataset.title,
        rows: rows.filter((r) => r != null),
        config: dataset.makeConfig?.(rows.filter((r) => r != null)),
      });
    } catch (e) {
      setError(`failed to load ${dataset.title}: ${(e as Error).message}`);
    } finally {
      setLoading(null);
    }
  };

  const upload = async (file: File) => {
    setError(null);
    try {
      const rows = parseUpload(file.name, await file.text());
      // custom datasets get no preset — the config derives from the data
      setLoaded({ dataset: null, key: `custom:${file.name}`, title: file.name, rows, config: undefined });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // the flagship dataset loads on mount (deferred a tick — no sync setState in the effect)
  useEffect(() => {
    const timer = setTimeout(() => void pick(DEMO_DATASETS[0]), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="site-main">
      <h1>🪒 naiveparallel</h1>
      <p className="intro">
        A naive react parallel coordinates plot for <code>{"Array<T>"}</code> datasets. Designed for interactivity, scalability, and visual comprehension.
        Pick a preselected dataset+config pair below, or load your own — axes derive from the data columns automatically.
      </p>
      <p className="intro">
        naiveparallel is the charting sibling of{" "}
        <a href="https://naivetable.untra.io" target="_blank" rel="noreferrer">
          🍱 naivetable
        </a>{" "}
        — the same <code>{"Array<T>"}</code> in, a parallel coordinates plot out instead of a table.
      </p>
      <pre className="code-sample">
        <code>{USAGE_SNIPPET}</code>
      </pre>

      <div role="group" aria-label="datasets" className="dataset-tiles">
        {DEMO_DATASETS.map((dataset) => (
          <button
            key={dataset.id}
            type="button"
            disabled={dataset.disabled}
            aria-pressed={loaded?.key === dataset.id}
            className="dataset-tile"
            onClick={() => void pick(dataset)}
          >
            <strong>{loading === dataset.id ? "loading…" : dataset.title}</strong>
            <br />
            <small>{dataset.description}</small>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={loaded?.key.startsWith("custom:") ?? false}
          className="dataset-tile dataset-tile-upload"
          onClick={() => fileRef.current?.click()}
        >
          <strong>load your own…</strong>
          <br />
          <small>a .csv or .json array dataset</small>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,application/json,text/csv"
          aria-label="upload dataset"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <p role="alert" style={{ color: "#a00" }}>
          {error}
        </p>
      )}

      {loaded && (
        <section aria-label={loaded.title}>
          <h2 style={{ margin: "0.5rem 0 0" }}>
            {loaded.title} <small>({loaded.rows.length} rows)</small>
          </h2>
          {loaded.dataset && (
            <p style={{ margin: "0 0 0.5rem", fontSize: 13 }}>
              configured in{" "}
              <a
                href={`${GITHUB_DATASETS_BASE}${loaded.dataset.sourceFile}`}
                target="_blank"
                rel="noreferrer"
              >
                <code>src/demo/datasets/{loaded.dataset.sourceFile}</code> ↗
              </a>{" "}
              — the full component configuration for this dataset
            </p>
          )}
          <NaiveParallel key={loaded.key} data={loaded.rows} configuration={loaded.config}>
            <ParallelChart
              hints={loaded.dataset?.hints}
              margins={loaded.dataset?.hints ? { top: 60 } : undefined}
            />
            <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <ParallelColumn />
              <ParallelRow>
                {({ hoveredRow, selectedRow }) => {
                  const row = hoveredRow ?? selectedRow;
                  return (
                    <div style={{ minHeight: 70, minWidth: 260 }}>
                      {row ? (
                        (loaded.dataset?.renderRow?.(row) ?? (
                          <code style={{ fontSize: 11 }}>{JSON.stringify(row).slice(0, 200)}</code>
                        ))
                      ) : null}
                    </div>
                  );
                }}
              </ParallelRow>
            </div>
            <details style={{ margin: "0.5rem 0" }}>
              <summary>axes & colorizing</summary>
              <ParallelControl />
            </details>
          </NaiveParallel>
        </section>
      )}
    </main>
  );
}
