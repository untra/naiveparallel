import { STAT_COLORS, type StatKey, type StatMarkersConfig } from "../types";

/**
 * Whether a given stat marker should render at all, per the chart-level
 * config: hidden when the master toggle is off or this key is set to false.
 */
export function statShown(cfg: StatMarkersConfig | undefined, key: StatKey): boolean {
  return cfg?.enabled !== false && cfg?.colors?.[key] !== false;
}

/**
 * The render color for a stat marker: an override color string when one is
 * set, otherwise the conventional STAT_COLORS. (dispersion has no STAT_COLORS
 * entry and renders as a text badge — gate it with statShown instead.)
 */
export function statColor(
  cfg: StatMarkersConfig | undefined,
  key: keyof typeof STAT_COLORS
): string {
  const override = cfg?.colors?.[key];
  return typeof override === "string" ? override : STAT_COLORS[key];
}
