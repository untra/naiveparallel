import { baseball } from "./baseball";
import { cars } from "./cars";
import { colors } from "./colors";
import { movies } from "./movies";
import { pokemon } from "./pokemon";
import { stocks } from "./stocks";
import type { DemoDataset } from "./types";

/**
 * The six preselected dataset+config pairs offered on the home page. Each
 * later tile showcases a feature: colors → "components" RGB colorize,
 * movies → first-char ordinal mapping + diverging negative axis, stocks →
 * 3,000+ rows with clamped domains.
 */
export const DEMO_DATASETS: DemoDataset[] = [pokemon, baseball, cars, colors, movies, stocks];

export { parseUpload } from "./parseUpload";
export { presetConfig } from "./presetConfig";
export type { DemoDataset } from "./types";
