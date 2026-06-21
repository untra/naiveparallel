import React, { useMemo } from "react";
import { NaiveParallelProvider } from "../context/NaiveParallelProvider";
import { deriveConfig } from "../data/deriveConfig";
import type { DataObj, InferAxesOptions, NaiveParallelConfig } from "../types";
import { ParallelChart } from "./ParallelChart";
import type { Orientation } from "./chart/scales";
import { ParallelControl } from "./ParallelControl";

export interface NaiveParallelProps<T extends DataObj = DataObj> {
  /** The rows — any array of objects (null/undefined entries are skipped). */
  data: ReadonlyArray<T | null | undefined>;
  /** Axes + colorizing configuration; derived from the data when omitted. */
  configuration?: NaiveParallelConfig;
  /** Inference options applied when configuration is omitted. */
  inferOptions?: InferAxesOptions;
  /**
   * Chart layout direction, forwarded to the default ParallelChart (no effect
   * when you supply your own children). "auto" (default) picks vertical on a
   * portrait viewport, horizontal otherwise.
   */
  layout?: Orientation | "auto";
  /** Pixel spacing between adjacent axes, forwarded to the default ParallelChart. */
  axisSpacing?: number;
  /**
   * Opt-in ambient interaction hints (off by default), forwarded to the default
   * ParallelChart (no effect when you supply your own children — pass `hints` to
   * your own <ParallelChart> instead).
   */
  hints?: boolean;
  /**
   * Compound children (ParallelControl, ParallelChart, ParallelColumn,
   * ParallelRow, or anything using useNaiveParallel). With no children the
   * full default UI renders from the data alone.
   */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The root compound component: ingests data, resolves the configuration
 * (deriving axes from the data columns when none is provided), and provides
 * all derived state via context to the Parallel* children.
 *
 *   <NaiveParallel data={data} />                       // full default UI
 *   <NaiveParallel data={data}> <ParallelChart/> ... </NaiveParallel>
 */
export function NaiveParallel<T extends DataObj = DataObj>(props: NaiveParallelProps<T>) {
  const { data, configuration, inferOptions, layout, axisSpacing, hints, children, className, style } =
    props;

  const rows = useMemo(() => data.filter((row): row is T => row != null), [data]);

  const config = useMemo(
    () => configuration ?? deriveConfig(rows, inferOptions),
    [configuration, rows, inferOptions]
  );

  return (
    <div className={`np-root${className ? ` ${className}` : ""}`} style={style}>
      <NaiveParallelProvider data={rows} config={config}>
        {children ?? (
          <div className="np-default-ui">
            <ParallelChart layout={layout} axisSpacing={axisSpacing} hints={hints} />
            <ParallelControl />
          </div>
        )}
      </NaiveParallelProvider>
    </div>
  );
}
