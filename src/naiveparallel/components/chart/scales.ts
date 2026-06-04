import { scaleLinear, scalePoint, scaleUtc } from "d3-scale";
import type { ParallelAxis } from "../../types";

/**
 * The one scale both render layers share. LinesCanvas, AxisSvg and
 * StatMarkers all position through this interface, which is what guarantees
 * canvas polylines and SVG markers align on the same pixels.
 */
export interface AxisScale {
  /** Pixel y for an axis value (numbers for numerical, strings for ordinal); null when unmappable. */
  y(value: number | string | null): number | null;
  /** Tick marks to render along the axis. */
  ticks(count?: number): Array<{ value: string; y: number }>;
  /** Numerical only: invert a pixel back to a domain value. */
  invert(py: number): number | null;
  /** Ordinal only: the nearest value for a pixel (nearest-neighbor inversion). */
  invertPoint(py: number): string | null;
  /** Ordinal only: the pixel distance between adjacent value points. */
  step(): number | null;
}

/** Builds the scale mapping an axis' domain onto a vertical pixel range (top, bottom). */
export function buildScale(axis: ParallelAxis, range: [number, number]): AxisScale {
  if (axis.kind === "numerical") {
    if (axis.temporal) {
      // temporal: same epoch-ms positioning as linear, but a UTC time scale
      // gives date-boundary ticks and date-formatted labels. clamp(true) is
      // mandatory — time scales default to clamping disabled.
      const scale = scaleUtc().domain(axis.domain).range([range[1], range[0]]).clamp(true);
      return {
        y(value) {
          if (typeof value !== "number" || !Number.isFinite(value)) return null;
          return scale(value);
        },
        ticks(count = 6) {
          const format = scale.tickFormat();
          return scale.ticks(count).map((t) => ({ value: format(t), y: scale(t) }));
        },
        invert(py) {
          return scale.invert(py).getTime(); // Date -> epoch-ms number
        },
        invertPoint() {
          return null;
        },
        step() {
          return null;
        },
      };
    }
    // high values at the top: domain [min, max] -> range [bottom, top].
    // Clamped: a configured domain may be narrower than the data extent, and
    // out-of-domain values must pin to the axis ends, not draw outside the track.
    const scale = scaleLinear().domain(axis.domain).range([range[1], range[0]]).clamp(true);
    return {
      y(value) {
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        return scale(value);
      },
      ticks(count = 6) {
        return scale.ticks(count).map((t) => ({ value: String(t), y: scale(t) }));
      },
      invert(py) {
        return scale.invert(py);
      },
      invertPoint() {
        return null;
      },
      step() {
        return null;
      },
    };
  }

  const scale = scalePoint<string>().domain(axis.values).range([range[0], range[1]]).padding(0.5);
  return {
    y(value) {
      if (typeof value !== "string") return null;
      const py = scale(value);
      return py === undefined ? null : py;
    },
    ticks() {
      return axis.values.map((value) => ({ value, y: scale(value) ?? 0 }));
    },
    invert() {
      return null;
    },
    invertPoint(py) {
      // nearest-neighbor inversion (ported from ../parallel's invertPoint)
      let best: string | null = null;
      let bestDistance = Infinity;
      for (const value of axis.values) {
        const vy = scale(value);
        if (vy === undefined) continue;
        const distance = Math.abs(vy - py);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = value;
        }
      }
      return best;
    },
    step() {
      return scale.step();
    },
  };
}
