import { useNaiveParallel } from "../../context/NaiveParallelContext";
import { STAT_COLORS } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";
import type { Orientation } from "./scales";

/** Half-width of the stat marker glyphs, in px. */
const W = 14;
/** Full marker line thickness; max/min draw at half this. */
const THICK = 2;

/** A stat line crossing the axis at value-pixel `p` (horizontal in H, vertical in V). */
const crossLine = (orientation: Orientation, p: number, half = W) =>
  orientation === "vertical"
    ? { x1: p, x2: p, y1: -half, y2: half }
    : { x1: -half, x2: half, y1: p, y2: p };

/** The two IQR serifs at one bracket end, extending `len` toward the partner bracket. */
function serifs(orientation: Orientation, p: number, toward: number, len = 6) {
  const d = (toward > p ? len : -len) || len;
  return orientation === "vertical"
    ? [
        { x1: p, y1: -W, x2: p + d, y2: -W },
        { x1: p, y1: W, x2: p + d, y2: W },
      ]
    : [
        { x1: -W, y1: p, x2: -W, y2: p + d },
        { x1: W, y1: p, x2: W, y2: p + d },
      ];
}

/**
 * The selected axis' statistics rendered onto the chart in their
 * conventional colors, recomputed live as filters change (including
 * mid-brush).
 *
 * Numerical: red max (half thickness) / blue min (half thickness) /
 * green median / cyan mean / yellow IQR bracket / magenta dotted lines at
 * median±1σ. Ordinal: cyan mode dot, green median dash, and the dispersion
 * index as a badge near the axis.
 */
export function StatMarkers() {
  const { selectedAxis, selectedStats } = useNaiveParallel();
  const layout = useChartLayout();

  if (!selectedAxis || !selectedStats) return null;
  if (!layout.visibleAxes.some((a) => a.id === selectedAxis.id)) return null;

  const orientation = layout.orientation;
  const axisPos = layout.axisPos(selectedAxis.id);
  const [valueLo] = layout.valueExtent();
  const scale = layout.scaleOf(selectedAxis.id);
  const groupTransform =
    orientation === "vertical" ? `translate(0,${axisPos})` : `translate(${axisPos},0)`;

  if (selectedStats.kind === "numerical") {
    const { min, max, mean, median, stddev, q1, q3 } = selectedStats;
    const y = (v: number) => scale.y(v) ?? 0;
    // dotted ±1σ lines hang off the median (the scale clamps to the domain)
    const sigmaHi = y(median + stddev);
    const sigmaLo = y(median - stddev);
    return (
      <g className="np-stats" data-testid="np-stats" transform={groupTransform}>
        {/* yellow IQR bracket */}
        <g className="np-stat-iqr" stroke={STAT_COLORS.iqr} fill="none">
          <line {...crossLine(orientation, y(q3))} />
          <line {...crossLine(orientation, y(q1))} />
          {[...serifs(orientation, y(q3), y(q1)), ...serifs(orientation, y(q1), y(q3))].map((s, i) => (
            <line key={i} {...s} />
          ))}
        </g>
        {/* magenta dotted ±1σ from the median */}
        <g className="np-stat-stddev" stroke={STAT_COLORS.stddev} strokeDasharray="3 3">
          <line {...crossLine(orientation, sigmaHi)} />
          <line {...crossLine(orientation, sigmaLo)} />
        </g>
        <line className="np-stat-max" {...crossLine(orientation, y(max))} stroke={STAT_COLORS.max} strokeWidth={THICK / 2} />
        <line className="np-stat-mean" {...crossLine(orientation, y(mean))} stroke={STAT_COLORS.mean} strokeWidth={THICK} />
        <line className="np-stat-median" {...crossLine(orientation, y(median))} stroke={STAT_COLORS.median} strokeWidth={THICK} />
        <line className="np-stat-min" {...crossLine(orientation, y(min))} stroke={STAT_COLORS.min} strokeWidth={THICK / 2} />
      </g>
    );
  }

  const { mode, median, dispersion } = selectedStats;
  const modeP = scale.y(mode);
  const medianP = median === null ? null : scale.y(median);
  const dispersionProps =
    orientation === "vertical"
      ? ({ x: valueLo, y: -12, textAnchor: "start" } as const)
      : ({ y: layout.margins.top - 26, textAnchor: "middle" } as const);
  return (
    <g className="np-stats" data-testid="np-stats" transform={groupTransform}>
      {modeP !== null && (
        <circle
          className="np-stat-mode"
          cx={orientation === "vertical" ? modeP : 0}
          cy={orientation === "vertical" ? 0 : modeP}
          r={5}
          fill="none"
          stroke={STAT_COLORS.mode}
          strokeWidth={2}
        />
      )}
      {medianP !== null && (
        <line className="np-stat-median" {...crossLine(orientation, medianP)} stroke={STAT_COLORS.median} strokeWidth={2} />
      )}
      {/* dispersion index as a labeled badge near the axis */}
      <text className="np-stat-dispersion" {...dispersionProps} fontSize={10}>
        {`H ${dispersion.toFixed(2)}`}
      </text>
    </g>
  );
}
