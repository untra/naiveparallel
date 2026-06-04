import { autoType, csvParse } from "d3-dsv";
import type { DataObj } from "../../naiveparallel";

/**
 * Parses an uploaded custom dataset: a .json file holding a top-level array
 * of objects (null entries tolerated — the library guards them), or a .csv
 * with a header row (values auto-typed). Throws descriptive errors for the
 * UI to surface inline.
 */
export function parseUpload(filename: string, text: string): DataObj[] {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();

  if (extension === ".json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new Error(`${filename} is not valid JSON: ${(e as Error).message}`, { cause: e });
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${filename} must contain a top-level array of objects`);
    }
    const rows = parsed.filter((r) => r != null);
    if (rows.length === 0 || rows.some((r) => typeof r !== "object" || Array.isArray(r))) {
      throw new Error(`${filename} must contain at least one object row`);
    }
    return rows as DataObj[];
  }

  if (extension === ".csv") {
    const rows = csvParse(text, autoType) as unknown as DataObj[];
    if (rows.length === 0 || Object.keys(rows[0] ?? {}).length === 0) {
      throw new Error(`${filename} parsed to no rows — is the first line a header?`);
    }
    return rows;
  }

  throw new Error(`unsupported file type "${extension}" — upload a .csv or .json dataset`);
}
