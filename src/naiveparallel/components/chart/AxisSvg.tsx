import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { NumericalAxis, OrdinalAxis, ParallelAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";
import type { Orientation } from "./scales";
import { useAxisDrag } from "./useAxisDrag";
import { contiguousRun, useBrush } from "./useBrush";

export interface AxisSvgProps {
  axis: ParallelAxis;
}

/** SVG geometry of a rectangle centered on the axis line, spanning [a,b] along
 *  the value direction with half-thickness `half` across it. */
function crossRect(orientation: Orientation, a: number, b: number, half: number) {
  const lo = Math.min(a, b);
  const len = Math.max(0, Math.max(a, b) - lo);
  return orientation === "vertical"
    ? { x: lo, width: len, y: -half, height: half * 2 }
    : { x: -half, width: half * 2, y: lo, height: len };
}

/** The translate placing a tick at value-direction coordinate `v`. */
const tickTransform = (orientation: Orientation, v: number) =>
  orientation === "vertical" ? `translate(${v},0)` : `translate(0,${v})`;

/** The little tick mark stroked off the axis line (left in horizontal, below in vertical). */
const tickLineProps = (orientation: Orientation) =>
  orientation === "vertical" ? { x1: 0, x2: 0, y1: 0, y2: 4 } : { x1: -4, x2: 0, y1: 0, y2: 0 };

/** Tick label placement relative to its tick mark. */
const tickLabelProps = (orientation: Orientation) =>
  orientation === "vertical"
    ? ({ y: 16, textAnchor: "middle" } as const)
    : ({ x: -7, dy: "0.32em", textAnchor: "end" } as const);

/**
 * One SVG axis. In horizontal layout it is a vertical line with value ticks to
 * its left and the label above; in vertical layout a horizontal line with ticks
 * below and the label off its left end. Either way the interactive regions are
 * the **label** (click to select, drag to reorder) and the **track** (drag to
 * brush a range — numerical, or a contiguous value run snapped to whole bands —
 * ordinal; click to clear). Label and track never overlap, so dragging and
 * brushing cannot conflict.
 */
export function AxisSvg({ axis }: AxisSvgProps) {
  const { config, selectAxis } = useNaiveParallel();
  const layout = useChartLayout();
  const orientation = layout.orientation;
  const axisPos = layout.axisPos(axis.id);
  const [valueLo, valueHi] = layout.valueExtent();
  const selected = config.selectedAxisId === axis.id;
  const drag = useAxisDrag(axis);

  const groupTransform =
    orientation === "vertical"
      ? `translate(0,${axisPos + drag.offset})`
      : `translate(${axisPos + drag.offset},0)`;

  const lineProps =
    orientation === "vertical"
      ? { x1: valueLo, x2: valueHi, y1: 0, y2: 0 }
      : { x1: 0, x2: 0, y1: valueLo, y2: valueHi };

  const labelProps =
    orientation === "vertical"
      ? ({ x: valueLo - 8, dy: "0.32em", textAnchor: "end" } as const)
      : ({ y: valueLo - 12, textAnchor: "middle" } as const);

  return (
    <g
      className={`np-axis np-axis-${axis.kind}${selected ? " np-axis-selected" : ""}${drag.dragging ? " np-axis-dragging" : ""}`}
      data-testid={`np-axis-${axis.id}`}
      transform={groupTransform}
    >
      <line className="np-axis-line" {...lineProps} stroke="currentColor" />
      {axis.kind === "numerical" ? (
        <NumericalTrack axis={axis} />
      ) : (
        <OrdinalTrack axis={axis} />
      )}
      <text
        className="np-axis-label"
        {...labelProps}
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

function NumericalTrack({ axis }: { axis: NumericalAxis }) {
  const { filters } = useNaiveParallel();
  const layout = useChartLayout();
  const orientation = layout.orientation;
  const [valueLo, valueHi] = layout.valueExtent();
  const scale = layout.scaleOf(axis.id);
  const brush = useBrush(axis);

  const filter = filters[axis.id];
  const committed: [number, number] | null =
    filter?.kind === "numeric"
      ? [scale.y(filter.max) ?? valueLo, scale.y(filter.min) ?? valueHi]
      : null;
  const active = brush.extent ?? committed;

  return (
    <g className="np-axis-track">
      {scale.ticks(6).map((tick) => (
        <g key={tick.value} className="np-axis-tick" transform={tickTransform(orientation, tick.y)}>
          <line {...tickLineProps(orientation)} stroke="currentColor" />
          <text className="np-axis-tick-label" {...tickLabelProps(orientation)}>
            {tick.value}
          </text>
        </g>
      ))}
      {active && (
        <rect
          className="np-brush"
          data-testid={`np-brush-${axis.id}`}
          {...crossRect(orientation, active[0], active[1], 8)}
        />
      )}
      <rect
        className="np-brush-track"
        {...crossRect(orientation, valueLo, valueHi, 10)}
        fill="transparent"
        {...brush.handlers}
      />
    </g>
  );
}

function OrdinalTrack({ axis }: { axis: OrdinalAxis }) {
  const { filters } = useNaiveParallel();
  const layout = useChartLayout();
  const orientation = layout.orientation;
  const [valueLo, valueHi] = layout.valueExtent();
  const scale = layout.scaleOf(axis.id);
  const brush = useBrush(axis);

  const filter = filters[axis.id];
  const enabled = (value: string) => filter?.kind !== "ordinal" || filter.enabled.has(value);

  // the committed band: only a contiguous run draws (and grabs) as one; a
  // non-contiguous programmatic set still dims its excluded ticks below
  let committed: [number, number] | null = null;
  if (filter?.kind === "ordinal") {
    const run = contiguousRun(axis.values, filter.enabled);
    const step = scale.step();
    const first = run && scale.y(axis.values[run[0]]);
    const last = run && scale.y(axis.values[run[1]]);
    if (step !== null && Number.isFinite(step) && step > 0 && first !== null && last !== null) {
      committed = [first - step / 2, last + step / 2];
    }
  }
  const active = brush.extent ?? committed;

  return (
    <g className="np-axis-track">
      {scale.ticks().map((tick) => (
        <g
          key={tick.value}
          className={`np-axis-tick np-ordinal-value${enabled(tick.value) ? "" : " np-ordinal-disabled"}`}
          transform={tickTransform(orientation, tick.y)}
        >
          <line {...tickLineProps(orientation)} stroke="currentColor" />
          <text
            className="np-axis-tick-label"
            {...tickLabelProps(orientation)}
            fill={axis.colors[tick.value]}
          >
            {tick.value}
          </text>
        </g>
      ))}
      {active && (
        <rect
          className="np-brush"
          data-testid={`np-brush-${axis.id}`}
          {...crossRect(orientation, active[0], active[1], 8)}
        />
      )}
      <rect
        className="np-brush-track"
        {...crossRect(orientation, valueLo, valueHi, 10)}
        fill="transparent"
        {...brush.handlers}
      />
    </g>
  );
}
