import type { ReactNode } from "react";
import type { DataObj, NaiveParallelConfig } from "../../naiveparallel";

/** A preselected dataset+config pair offered on the demo home page. */
export interface DemoDataset {
  id: string;
  title: string;
  /** One-liner shown in the selector tile. */
  description: string;
  /** True for the reserved "coming soon" slots. */
  disabled?: boolean;
  /** Lazy-loads the rows (vite code-splits the JSON chunk). */
  load?: () => Promise<DataObj[]>;
  /** Builds the tasteful preset configuration from the loaded rows. */
  makeConfig?: (rows: DataObj[]) => NaiveParallelConfig;
  /** Renders the hovered/pinned row card for ParallelRow. */
  renderRow?: (row: DataObj) => ReactNode;
}
