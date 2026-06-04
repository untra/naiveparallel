import { baseball } from "./baseball";
import { cars } from "./cars";
import { pokemon } from "./pokemon";
import type { DemoDataset } from "./types";

/**
 * The six preselected dataset+config pairs offered on the home page —
 * three defined, three slots reserved for datasets TBD.
 */
export const DEMO_DATASETS: DemoDataset[] = [
  pokemon,
  baseball,
  cars,
  { id: "tbd-1", title: "coming soon", description: "a fourth dataset, TBD", disabled: true },
  { id: "tbd-2", title: "coming soon", description: "a fifth dataset, TBD", disabled: true },
  { id: "tbd-3", title: "coming soon", description: "a sixth dataset, TBD", disabled: true },
];

export { parseUpload } from "./parseUpload";
export { presetConfig } from "./presetConfig";
export type { DemoDataset } from "./types";
