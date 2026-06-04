import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { ParallelAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

export interface AxisSvgProps {
  axis: ParallelAxis;
}

/**
 * One SVG axis: the vertical line, value ticks, and the clickable name label.
 * Clicking the label selects the axis (the selected column). The label region
 * doubles as the drag-reorder handle; the line below is the brush track.
 */
export function AxisSvg({ axis }: AxisSvgProps) {
  const { config, selectAxis } = useNaiveParallel();
  const layout = useChartLayout();
  const x = layout.xOf(axis.id);
  const scale = layout.scaleOf(axis.id);
  const selected = config.selectedAxisId === axis.id;

  const top = layout.margins.top;
  const bottom = layout.height - layout.margins.bottom;
  const ticks = scale.ticks(axis.kind === "numerical" ? 6 : undefined);

  return (
    <g
      className={`np-axis np-axis-${axis.kind}${selected ? " np-axis-selected" : ""}`}
      data-testid={`np-axis-${axis.id}`}
      transform={`translate(${x},0)`}
    >
      <line className="np-axis-line" y1={top} y2={bottom} stroke="currentColor" />
      {ticks.map((tick) => (
        <g key={tick.value} className="np-axis-tick" transform={`translate(0,${tick.y})`}>
          <line x1={-4} x2={0} stroke="currentColor" />
          <text className="np-axis-tick-label" x={-7} dy="0.32em" textAnchor="end">
            {tick.value}
          </text>
        </g>
      ))}
      <text
        className="np-axis-label"
        y={top - 12}
        textAnchor="middle"
        onClick={() => selectAxis(selected ? null : axis.id)}
      >
        {axis.label}
      </text>
    </g>
  );
}
