import { describe, expect, it } from "vitest";
import { parseUpload } from "./parseUpload";

describe("parseUpload", () => {
  it("parses a JSON array of objects, tolerating null entries", () => {
    const rows = parseUpload("data.json", '[null, {"a": 1}, {"a": 2}]');
    expect(rows).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it("parses CSV with auto-typed values", () => {
    const rows = parseUpload("data.csv", "name,score,active\nalpha,1.5,true\nbeta,2,false\n");
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("alpha");
    expect(rows[0].score).toBe(1.5); // number, not string
    expect(typeof rows[1].score).toBe("number");
  });

  it("rejects non-array JSON", () => {
    expect(() => parseUpload("data.json", '{"a": 1}')).toThrow(/top-level array/);
  });

  it("rejects invalid JSON with the parser message", () => {
    expect(() => parseUpload("data.json", "not json")).toThrow(/not valid JSON/);
  });

  it("rejects arrays without object rows", () => {
    expect(() => parseUpload("data.json", "[1, 2, 3]")).toThrow(/object row/);
    expect(() => parseUpload("data.json", "[null]")).toThrow(/object row/);
  });

  it("rejects empty CSV", () => {
    expect(() => parseUpload("data.csv", "")).toThrow(/no rows/);
  });

  it("rejects unsupported extensions", () => {
    expect(() => parseUpload("data.xlsx", "")).toThrow(/unsupported file type/);
  });
});
