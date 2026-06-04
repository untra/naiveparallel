import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { NumericalAxis, OrdinalAxis, ParallelAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";
import { useAxisDrag } from "./useAxisDrag";
import { useBrush } from "./useBrush";

export interface AxisSvgProps {
  axis: ParallelAxis;
}

/**
 * One SVG axis: vertical line, value ticks, and the interactive regions —
 * the **label** (click to select, drag to reorder) and the **track**
 * (numerical: drag to brush a range, click to clear; ordinal: click values
 * to toggle them). Label and track never overlap, so dragging and brushing
 * cannot conflict.
 */
export function AxisSvg({ axis }: AxisSvgProps) {
  const { config, selectAxis } = useNaiveParallel();
  const layout = useChartLayout();
  const x = layout.xOf(axis.id);
  const selected = config.selectedAxisId === axis.id;
  const drag = useAxisDrag(axis);

  const top = layout.margins.top;
  const bottom = layout.height - layout.margins.bottom;

  return (
    <g
      className={`np-axis np-axis-${axis.kind}${selected ? " np-axis-selected" : ""}${drag.dragging ? " np-axis-dragging" : ""}`}
      data-testid={`np-axis-${axis.id}`}
      transform={`translate(${x + drag.dx},0)`}
    >
      <line className="np-axis-line" y1={top} y2={bottom} stroke="currentColor" />
      {axis.kind === "numerical" ? (
        <NumericalTrack axis={axis} top={top} bottom={bottom} />
      ) : (
        <OrdinalTrack axis={axis} />
      )}
      <text
        className="np-axis-label"
        y={top - 12}
        textAnchor="middle"
        onClick={() => {
          if (!drag.dragging) selectAxis(selected ? null : axis.id);
        }}
        {...drag.handlers}
      >
        {axis.label}
      </text>
    </g>
  );
}

function NumericalTrack({ axis, top, bottom }: { axis: NumericalAxis; top: number; bottom: number }) {
  const { filters } = useNaiveParallel();
  const layout = useChartLayout();
  const scale = layout.scaleOf(axis.id);
  const brush = useBrush(axis);

  const filter = filters[axis.id];
  const committed: [number, number] | null =
    filter?.kind === "numeric"
      ? [scale.y(filter.max) ?? top, scale.y(filter.min) ?? bottom]
      : null;
  const active = brush.extent ?? committed;

  return (
    <g className="np-axis-track">
      {scale.ticks(6).map((tick) => (
        <g key={tick.value} className="np-axis-tick" transform={`translate(0,${tick.y})`}>
          <line x1={-4} x2={0} stroke="currentColor" />
          <text className="np-axis-tick-label" x={-7} dy="0.32em" textAnchor="end">
            {tick.value}
          </text>
        </g>
      ))}
      {active && (
        <rect
          className="np-brush"
          data-testid={`np-brush-${axis.id}`}
          x={-8}
          width={16}
          y={active[0]}
          height={Math.max(0, active[1] - active[0])}
        />
      )}
      <rect
        className="np-brush-track"
        x={-10}
        width={20}
        y={top}
        height={bottom - top}
        fill="transparent"
        {...brush.handlers}
      />
    </g>
  );
}

function OrdinalTrack({ axis }: { axis: OrdinalAxis }) {
  const { filters, toggleOrdinalValue } = useNaiveParallel();
  const layout = useChartLayout();
  const scale = layout.scaleOf(axis.id);

  const filter = filters[axis.id];
  const enabled = (value: string) => filter?.kind !== "ordinal" || filter.enabled.has(value);

  return (
    <g className="np-axis-track">
      {scale.ticks().map((tick) => (
        <g
          key={tick.value}
          className={`np-axis-tick np-ordinal-value${enabled(tick.value) ? "" : " np-ordinal-disabled"}`}
          transform={`translate(0,${tick.y})`}
        >
          <line x1={-4} x2={0} stroke="currentColor" />
          <text
            className="np-axis-tick-label"
            x={-7}
            dy="0.32em"
            textAnchor="end"
            fill={axis.colors[tick.value]}
            onClick={() => toggleOrdinalValue(axis.id, tick.value)}
          >
            {tick.value}
          </text>
        </g>
      ))}
    </g>
  );
}
