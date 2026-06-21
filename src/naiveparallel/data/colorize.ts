import { scaleLinear } from "d3-scale";
import type { DataObj, NaiveParallelConfig, NumericAxis, ParallelAxis } from "../types";
import { isNumericAxis } from "../types";
import { axisValue } from "./accessors";
import { numericalStats } from "./stats";

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

/**
 * Converts an HSV triple (hue 0–360, saturation/value 0–1) to an uppercase
 * #RRGGBB hex. Unlike hslToHex this keeps full control of brightness (V)
 * independent of saturation, so a vivid color can also be dimmed.
 */
const hsvToHex = (h: number, s: number, v: number): string => {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = v - c;
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r1)}${to(g1)}${to(b1)}`.toUpperCase();
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

  if (isNumericAxis(axis)) {
    if (axis.kind === "temporal") {
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

/** Hue (0..360) of an rgb triple in 0..255, or null when achromatic. */
const rgbToHue = (r: number, g: number, b: number): number | null => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return null;
  const h =
    max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60);
};

/** Hue of any color string a colorizer can emit, or null when achromatic/unknown. */
function hueOf(color: string): number | null {
  let m = /^#([0-9a-f]{6})$/i.exec(color);
  if (m) {
    const n = parseInt(m[1], 16);
    return rgbToHue(n >> 16, (n >> 8) & 0xff, n & 0xff);
  }
  m = /^#([0-9a-f]{3})$/i.exec(color);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return rgbToHue(r, g, b);
  }
  m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color);
  if (m) return rgbToHue(+m[1], +m[2], +m[3]);
  m = /^hsl\(\s*(\d+(?:\.\d+)?)\s*,/.exec(color);
  if (m) return Math.round(+m[1]) % 360;
  return null;
}

const muteCache = new Map<string, string>();

/**
 * The pale tint of a row color: same hue, desaturated and lightened. Muted
 * (filtered-out) canvas strokes use this so alpha compositing converges to
 * the tint under any overdraw — a dense pile of excluded rows can never
 * re-saturate into the vivid row color. Achromatic or unparseable colors
 * (named CSS colors included) tint to neutral gray.
 */
export function muteColor(color: string): string {
  let muted = muteCache.get(color);
  if (muted === undefined) {
    const hue = hueOf(color);
    muted = hue === null ? "hsl(0, 0%, 86%)" : `hsl(${hue}, 30%, 86%)`;
    muteCache.set(color, muted);
  }
  return muted;
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
    .filter((a): a is NumericAxis => isNumericAxis(a) && !a.hidden)
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

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Projects an axis onto a number per row: the value itself for numerical axes,
 * the value's index in the axis' low-to-high ordering for ordinal axes.
 * Missing / unparseable values yield null.
 */
function axisProjector(axis: ParallelAxis): (row: DataObj) => number | null {
  if (isNumericAxis(axis)) {
    return (row) => {
      const v = axisValue(axis, row);
      return typeof v === "number" ? v : null;
    };
  }
  const index = new Map(axis.values.map((v, i) => [v, i]));
  return (row) => {
    const v = axisValue(axis, row);
    return typeof v === "string" ? (index.get(v) ?? null) : null;
  };
}

/**
 * Colorizes every row with a unique, stable color derived from a single
 * column, decorrelating three HSV channels so adjacent rows stay
 * distinguishable and the channels read as distribution diagnostics (computed
 * over the whole, unfiltered dataset so a row's color never shifts as filters
 * change). HSV keeps saturation high so no in-range row reads as washed-out /
 * deselected — unlike the muted (brushed-out) pale tints:
 *
 *   Hue        — positional rank of the value, swept 0°→300° (red→magenta) so
 *                even adjacent values get distinct hues, ends never collide.
 *   Saturation — signed z-score from the mean, a slight nudge in a high band:
 *                always vivid, above-mean rows a touch more saturated.
 *   Value      — folded deviation from the median, scaled by the IQR: median
 *                rows dimmer, the further into the tails the brighter (outliers
 *                pop at full brightness).
 *
 * Rows with no value for the column (or a null axis / empty column) fall back.
 */
export function buildDistinguishColorizer(
  axis: ParallelAxis | null,
  rows: ReadonlyArray<DataObj>
): (row: DataObj) => string {
  if (axis === null) return () => FALLBACK_COLOR;

  const project = axisProjector(axis);
  const entries: Array<[DataObj, number]> = [];
  for (const row of rows) {
    const v = project(row);
    if (v !== null && !Number.isNaN(v)) entries.push([row, v]);
  }
  if (entries.length === 0) return () => FALLBACK_COLOR;

  const stats = numericalStats(entries.map(([, v]) => v));
  if (stats === null) return () => FALLBACK_COLOR;

  const iqr = stats.q3 - stats.q1;
  const spread = iqr || stats.max - stats.min || 1;
  const sigma = stats.stddev || 1;
  const n = entries.length;

  // positional rank (ascending by value): every row a distinct rank 0..n-1, so
  // even duplicate values get adjacent — and therefore different — hues.
  const valueOf = new Map(entries);
  const rankOf = new Map<DataObj, number>();
  [...entries]
    .sort((a, b) => a[1] - b[1])
    .forEach(([row], i) => rankOf.set(row, i));

  // hue spans red→magenta (not the full wheel) so min and max stay distinct;
  // saturation stays in a high band (slight z-score nudge) so rows read vivid;
  // brightness ranges median(dim)→tails(bright) so outliers pop.
  const HUE_SPAN = 300,
    S_MIN = 0.7,
    S_RANGE = 0.25,
    V_MIN = 0.6,
    V_RANGE = 0.4;

  return (row) => {
    const v = valueOf.get(row);
    if (v === undefined) return FALLBACK_COLOR;
    const hue = n > 1 ? (rankOf.get(row)! / (n - 1)) * HUE_SPAN : 0;
    const zNorm = clamp01(0.5 + (v - stats.mean) / sigma / 6);
    const g = clamp01(Math.abs(v - stats.median) / spread / 2);
    return hsvToHex(hue, S_MIN + S_RANGE * zNorm, V_MIN + V_RANGE * g);
  };
}

/**
 * Resolves which axis currently drives row colorizing: the locked axis when
 * colorizeMode is "locked", the locked axis when "distinguish" (else following
 * the selected axis like "follow"), otherwise following the selected axis,
 * otherwise the default identity axis at position [0]. Components mode
 * colorizes from three axes at once, so no single axis resolves.
 */
export function resolveColorizeAxis(config: NaiveParallelConfig): ParallelAxis | null {
  if (config.colorizeMode === "components") return null;
  const byId = (id: string | null) => config.axes.find((a) => a.id === id) ?? null;
  if (config.colorizeMode === "distinguish" && config.colorizeAxisId) {
    return byId(config.colorizeAxisId);
  }
  if (config.colorizeMode === "locked" && config.colorizeAxisId) {
    return byId(config.colorizeAxisId);
  }
  return byId(config.selectedAxisId) ?? config.axes[0] ?? null;
}
