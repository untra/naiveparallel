import { useNaiveParallel } from "../../context/NaiveParallelContext";
import { STAT_COLORS } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

/** Half-width of the stat marker glyphs, in px. */
const W = 14;

/**
 * The selected axis' statistics rendered onto the chart in their
 * conventional colors, recomputed live as filters change.
 *
 * Numerical (6): red max / green mean / blue median / yellow ±1σ band /
 * cyan IQR bracket / magenta min. Ordinal (3): mode dot, median dash, and
 * the dispersion index as an opacity-scaled bar at the axis top.
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
    const sigmaTop = y(Math.min(mean + stddev, selectedAxis.kind === "numerical" ? selectedAxis.domain[1] : mean + stddev));
    const sigmaBottom = y(Math.max(mean - stddev, selectedAxis.kind === "numerical" ? selectedAxis.domain[0] : mean - stddev));
    return (
      <g className="np-stats" data-testid="np-stats" transform={`translate(${x},0)`}>
        {/* yellow ±1σ band */}
        <rect
          className="np-stat-stddev"
          x={-W}
          width={W * 2}
          y={sigmaTop}
          height={Math.max(0, sigmaBottom - sigmaTop)}
          fill={STAT_COLORS.stddev}
          opacity={0.25}
        />
        {/* cyan IQR bracket */}
        <g className="np-stat-iqr" stroke={STAT_COLORS.iqr} fill="none">
          <path d={`M${-W},${y(q3)} h${W * 2}`} />
          <path d={`M${-W},${y(q1)} h${W * 2}`} />
          <path d={`M${-W},${y(q3)} v6 M${W},${y(q3)} v6 M${-W},${y(q1)} v-6 M${W},${y(q1)} v-6`} />
        </g>
        <line className="np-stat-max" x1={-W} x2={W} y1={y(max)} y2={y(max)} stroke={STAT_COLORS.max} strokeWidth={2} />
        <line className="np-stat-mean" x1={-W} x2={W} y1={y(mean)} y2={y(mean)} stroke={STAT_COLORS.mean} strokeWidth={2} />
        <line className="np-stat-median" x1={-W} x2={W} y1={y(median)} y2={y(median)} stroke={STAT_COLORS.median} strokeWidth={2} />
        <line className="np-stat-min" x1={-W} x2={W} y1={y(min)} y2={y(min)} stroke={STAT_COLORS.min} strokeWidth={2} />
      </g>
    );
  }

  const { mode, median, dispersion } = selectedStats;
  const modeY = scale.y(mode);
  const medianY = median === null ? null : scale.y(median);
  return (
    <g className="np-stats" data-testid="np-stats" transform={`translate(${x},0)`}>
      {modeY !== null && (
        <circle className="np-stat-mode" cx={0} cy={modeY} r={5} fill="none" stroke="black" strokeWidth={2} />
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
