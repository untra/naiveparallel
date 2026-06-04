import { scaleLinear } from "d3-scale";
import type { DataObj, NaiveParallelConfig, NumericalAxis, ParallelAxis } from "../types";
import { axisValue } from "./accessors";

/** Stroke used when no axis drives colorizing or a row has no value. */
export const FALLBACK_COLOR = "steelblue";

/** Fixed saturation 85% / lightness 55% keep every hue bright and high contrast. */
const hslToHex = (h: number, s = 85, l = 55) => {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};

/** Hashes a string to a stable hue in [0, 360). */
const hueFromString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
};

/**
 * Two complementary (180° apart), bright, high-contrast hex colors derived
 * deterministically from a string — the endpoints of a numerical axis' ramp.
 */
export const stringToBrightGradient = (str: string): [string, string] => {
  const hue1 = hueFromString(str);
  return [hslToHex(hue1), hslToHex((hue1 + 180) % 360)];
};

/**
 * Builds a row-colorizing function from an axis. Numerical axes ramp by kind:
 * temporal → the blue-to-red hue ramp (early → late); a domain crossing zero →
 * a diverging ramp anchored at value 0 (red at the negative min, yellow at 0,
 * green at the positive max); otherwise → a half-wheel hue sweep between the
 * axis' own complementary pair from stringToBrightGradient(axis.id). Ordinal
 * axes use their per-value colors. A null axis yields the fallback.
 */
export function buildColorizer(axis: ParallelAxis | null): (row: DataObj) => string {
  if (axis === null) return () => FALLBACK_COLOR;

  if (axis.kind === "numerical") {
    if (axis.temporal) {
      const t = scaleLinear().domain(axis.domain).range([0, 1]).clamp(true);
      return (row) => {
        const value = axisValue(axis, row);
        if (typeof value !== "number") return FALLBACK_COLOR;
        // hue 240 (blue, early) -> 0 (red, late)
        return `hsl(${Math.round(240 - 240 * t(value))}, 70%, 50%)`;
      };
    }

    const [min, max] = axis.domain;
    if (min < 0) {
      // diverging: red 0° at min -> yellow 60° at value 0 -> green 120° at max.
      // Piecewise (not a polylinear [min, 0, max] domain, which is
      // non-monotonic when max <= 0) so the pivot anchors at value 0 even
      // for asymmetric or all-negative domains.
      return (row) => {
        const value = axisValue(axis, row);
        if (typeof value !== "number") return FALLBACK_COLOR;
        const v = Math.min(Math.max(value, min), max);
        const hue = v <= 0 ? (60 * (v - min)) / (0 - min) : 60 + (60 * v) / max;
        return hslToHex(hue);
      };
    }

    // complementary sweep: half the hue wheel between the axis' bright pair
    const t = scaleLinear().domain(axis.domain).range([0, 1]).clamp(true);
    const hue1 = hueFromString(axis.id);
    return (row) => {
      const value = axisValue(axis, row);
      if (typeof value !== "number") return FALLBACK_COLOR;
      return hslToHex((hue1 + 180 * t(value)) % 360);
    };
  }

  return (row) => {
    const value = axisValue(axis, row);
    if (typeof value !== "string") return FALLBACK_COLOR;
    return axis.colors[value] ?? FALLBACK_COLOR;
  };
}

/**
 * Colorizes rows by their placement on the first three visible numerical axes
 * in display order — the R, G, and B channels respectively. Rearranging the
 * axes remaps the channels. A missing row value (or a missing axis, when fewer
 * than three numerical axes exist) zeroes its channel; with no numerical axes
 * at all every row falls back.
 */
export function buildComponentColorizer(config: NaiveParallelConfig): (row: DataObj) => string {
  const channels = config.axes
    .filter((a): a is NumericalAxis => a.kind === "numerical" && !a.hidden)
    .slice(0, 3);
  if (channels.length === 0) return () => FALLBACK_COLOR;
  const scales = channels.map((axis) => scaleLinear().domain(axis.domain).range([0, 1]).clamp(true));

  return (row) => {
    const [r, g, b] = [0, 1, 2].map((i) => {
      const axis = channels[i];
      if (!axis) return 0;
      const value = axisValue(axis, row);
      return typeof value === "number" ? Math.round(255 * scales[i](value)) : 0;
    });
    return `rgb(${r}, ${g}, ${b})`;
  };
}

/**
 * Resolves which axis currently drives row colorizing: the locked axis when
 * colorizeMode is "locked", otherwise following the selected axis, otherwise
 * the default identity axis at position [0]. Components mode colorizes from
 * three axes at once, so no single axis resolves.
 */
export function resolveColorizeAxis(config: NaiveParallelConfig): ParallelAxis | null {
  if (config.colorizeMode === "components") return null;
  const byId = (id: string | null) => config.axes.find((a) => a.id === id) ?? null;
  if (config.colorizeMode === "locked" && config.colorizeAxisId) {
    return byId(config.colorizeAxisId);
  }
  return byId(config.selectedAxisId) ?? config.axes[0] ?? null;
}
