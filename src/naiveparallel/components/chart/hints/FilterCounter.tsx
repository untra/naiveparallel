import React from "react";
import { useNaiveParallel } from "../../../context/NaiveParallelContext";
import { useChartLayout } from "../ChartLayoutContext";
import { usePulseWeight } from "./usePulseWeight";

/**
 * The brush payoff: a small `kept / total` readout near the active axis, shown
 * only while a filter is active (so an unfiltered chart stays quiet). The
 * numerator adopts the font-weight pulse motif, swelling then easing on each
 * change to draw the eye to the shrinking count while brushing. Non-interactive.
 */
export function FilterCounter() {
  const layout = useChartLayout();
  const { filteredData, data, filters, selectedAxis } = useNaiveParallel();
  const weight = usePulseWeight(filteredData.length);

  const hasFilter = Object.keys(filters).length > 0;
  const axis = selectedAxis ?? layout.visibleAxes[0] ?? null;
  if (!hasFilter || !axis) return null;

  const axisPos = layout.axisPos(axis.id);
  const [valueLo] = layout.valueExtent();

  // horizontal: a subheader centered directly under the (raised) axis title;
  // vertical: anchored to the leading edge of the active axis
  const style: React.CSSProperties =
    layout.orientation === "vertical"
      ? { left: valueLo + 4, top: Math.max(2, axisPos - 24) }
      : { left: axisPos, top: Math.max(2, valueLo - 16), transform: "translateX(-50%)" };

  return (
    <div
      className="np-hint-counter"
      data-testid="np-hint-counter"
      style={{ position: "absolute", pointerEvents: "none", ...style }}
    >
      <span
        className="np-hint-counter-num"
        data-testid="np-hint-counter-num"
        style={{ fontWeight: weight }}
      >
        {filteredData.length.toLocaleString()}
      </span>
      {" / "}
      {data.length.toLocaleString()}
    </div>
  );
}
