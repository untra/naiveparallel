import { useNaiveParallel } from "../../context/NaiveParallelContext";
import { STAT_COLORS } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

/** Half-width of the stat marker glyphs, in px. */
const W = 14;
/** Full marker line thickness; max/min draw at half this. */
const THICK = 2;

/**
 * The selected axis' statistics rendered onto the chart in their
 * conventional colors, recomputed live as filters change (including
 * mid-brush).
 *
 * Numerical: red max (half thickness) / blue min (half thickness) /
 * green median / cyan mean / yellow IQR bracket / magenta dotted lines at
 * median±1σ. Ordinal: cyan mode dot, green median dash, and the dispersion
 * index as a badge above the axis.
 */
export function StatMarkers() {
  const { selectedAxis, selectedStats } = useNaiveParallel();
  const layout = useChartLayout();

  if (!selectedAxis || !selectedStats) return null;
  if (!layout.visibleAxes.some((a) => a.id === selectedAxis.id)) return null;

  const x = layout.xOf(selectedAxis.id);
  const scale = layout.scaleOf(selectedAxis.id);

  if (selectedStats.kind === "numerical") {
    const { min, max, mean, median, stddev, q1, q3 } = selectedStats;
    const y = (v: number) => scale.y(v) ?? 0;
    // dotted ±1σ lines hang off the median (the scale clamps to the domain)
    const sigmaHi = y(median + stddev);
    const sigmaLo = y(median - stddev);
    return (
      <g className="np-stats" data-testid="np-stats" transform={`translate(${x},0)`}>
        {/* yellow IQR bracket */}
        <g className="np-stat-iqr" stroke={STAT_COLORS.iqr} fill="none">
          <path d={`M${-W},${y(q3)} h${W * 2}`} />
          <path d={`M${-W},${y(q1)} h${W * 2}`} />
          <path d={`M${-W},${y(q3)} v6 M${W},${y(q3)} v6 M${-W},${y(q1)} v-6 M${W},${y(q1)} v-6`} />
        </g>
        {/* magenta dotted ±1σ from the median */}
        <g className="np-stat-stddev" stroke={STAT_COLORS.stddev} strokeDasharray="3 3">
          <line x1={-W} x2={W} y1={sigmaHi} y2={sigmaHi} />
          <line x1={-W} x2={W} y1={sigmaLo} y2={sigmaLo} />
        </g>
        <line className="np-stat-max" x1={-W} x2={W} y1={y(max)} y2={y(max)} stroke={STAT_COLORS.max} strokeWidth={THICK / 2} />
        <line className="np-stat-mean" x1={-W} x2={W} y1={y(mean)} y2={y(mean)} stroke={STAT_COLORS.mean} strokeWidth={THICK} />
        <line className="np-stat-median" x1={-W} x2={W} y1={y(median)} y2={y(median)} stroke={STAT_COLORS.median} strokeWidth={THICK} />
        <line className="np-stat-min" x1={-W} x2={W} y1={y(min)} y2={y(min)} stroke={STAT_COLORS.min} strokeWidth={THICK / 2} />
      </g>
    );
  }

  const { mode, median, dispersion } = selectedStats;
  const modeY = scale.y(mode);
  const medianY = median === null ? null : scale.y(median);
  return (
    <g className="np-stats" data-testid="np-stats" transform={`translate(${x},0)`}>
      {modeY !== null && (
        <circle className="np-stat-mode" cx={0} cy={modeY} r={5} fill="none" stroke={STAT_COLORS.mode} strokeWidth={2} />
      )}
      {medianY !== null && (
        <line className="np-stat-median" x1={-W} x2={W} y1={medianY} y2={medianY} stroke={STAT_COLORS.median} strokeWidth={2} />
      )}
      {/* dispersion index as a labeled badge above the axis */}
      <text className="np-stat-dispersion" y={layout.margins.top - 26} textAnchor="middle" fontSize={10}>
        {`H ${dispersion.toFixed(2)}`}
      </text>
    </g>
  );
}
