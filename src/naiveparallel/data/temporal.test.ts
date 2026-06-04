import { describe, expect, it } from "vitest";
import {
  detectTemporalPattern,
  formatDuration,
  formatTemporal,
  parseTemporal,
} from "./temporal";

describe("parseTemporal", () => {
  it("parses ISO date-only as UTC midnight", () => {
    expect(parseTemporal("iso-date", "2024-01-15")).toBe(Date.UTC(2024, 0, 15));
  });

  it("parses ISO datetime with Z", () => {
    expect(parseTemporal("iso-datetime", "2024-01-15T13:45:00Z")).toBe(
      Date.UTC(2024, 0, 15, 13, 45, 0)
    );
  });

  it("parses ISO datetime without timezone as UTC", () => {
    expect(parseTemporal("iso-datetime", "2024-01-15T13:45")).toBe(
      Date.UTC(2024, 0, 15, 13, 45)
    );
  });

  it("applies a +hh:mm offset to reach UTC", () => {
    expect(parseTemporal("iso-datetime", "2024-01-15T13:45:00+02:00")).toBe(
      Date.UTC(2024, 0, 15, 11, 45, 0)
    );
  });

  it("applies a -hh:mm offset to reach UTC", () => {
    expect(parseTemporal("iso-datetime", "2024-01-15T13:45:00-05:00")).toBe(
      Date.UTC(2024, 0, 15, 18, 45, 0)
    );
  });

  it("parses millisecond precision", () => {
    expect(parseTemporal("iso-datetime", "2024-01-15T13:45:00.250Z")).toBe(
      Date.UTC(2024, 0, 15, 13, 45, 0, 250)
    );
  });

  it("parses M/D/YYYY", () => {
    expect(parseTemporal("us-slash", "1/15/2024")).toBe(Date.UTC(2024, 0, 15));
  });

  it("parses YYYY/M/D", () => {
    expect(parseTemporal("ymd-slash", "2024/1/15")).toBe(Date.UTC(2024, 0, 15));
  });

  it("parses month-name forms", () => {
    expect(parseTemporal("mon-d-y", "Jan 15 2024")).toBe(Date.UTC(2024, 0, 15));
    expect(parseTemporal("mon-d-y", "January 15, 2024")).toBe(Date.UTC(2024, 0, 15));
    expect(parseTemporal("d-mon-y", "15 Jan 2024")).toBe(Date.UTC(2024, 0, 15));
  });

  it("returns null on a non-matching string", () => {
    expect(parseTemporal("iso-date", "not a date")).toBeNull();
  });

  it("rejects dates before the 1970 unix epoch", () => {
    expect(parseTemporal("iso-date", "1969-12-31")).toBeNull();
    expect(parseTemporal("mon-d-y", "Dec 31 1969")).toBeNull();
    expect(parseTemporal("us-slash", "6/1/1950")).toBeNull();
  });

  it("accepts the epoch itself (1970-01-01 is ms 0)", () => {
    expect(parseTemporal("iso-date", "1970-01-01")).toBe(0);
  });

  it("rejects datetimes whose tz offset resolves before the epoch", () => {
    expect(parseTemporal("iso-datetime", "1970-01-01T00:00:00+01:00")).toBeNull();
  });

  it("returns null on out-of-range components (month 13)", () => {
    expect(parseTemporal("us-slash", "13/1/2024")).toBeNull();
  });

  it("returns null on rolled-over days (Feb 30)", () => {
    expect(parseTemporal("iso-date", "2024-02-30")).toBeNull();
  });

  it("returns null on an unknown month name", () => {
    expect(parseTemporal("mon-d-y", "Janx 15 2024")).toBeNull();
  });
});

describe("detectTemporalPattern", () => {
  it("detects a consistent ISO-date column", () => {
    expect(detectTemporalPattern(["2024-01-15", "2023-12-31"])).toBe("iso-date");
  });

  it("detects a consistent ISO-datetime column", () => {
    expect(
      detectTemporalPattern(["2024-01-15T10:00:00Z", "2024-02-01T23:59:59Z"])
    ).toBe("iso-datetime");
  });

  it("detects US-slash and month-name columns", () => {
    expect(detectTemporalPattern(["1/15/2024", "12/31/2023"])).toBe("us-slash");
    expect(detectTemporalPattern(["Jan 15 2024", "Dec 31 2023"])).toBe("mon-d-y");
  });

  it("returns null when one value breaks the first-picked pattern", () => {
    expect(detectTemporalPattern(["2024-01-15", "not a date"])).toBeNull();
  });

  it("returns null when a later value is out of range", () => {
    expect(detectTemporalPattern(["1/15/2024", "13/13/2024"])).toBeNull();
  });

  it("returns null when any value predates the 1970 epoch", () => {
    expect(detectTemporalPattern(["2024-01-15", "1969-01-01"])).toBeNull();
  });

  it("returns null for bare year strings", () => {
    expect(detectTemporalPattern(["1999", "2000"])).toBeNull();
  });

  it("returns null for plain words", () => {
    expect(detectTemporalPattern(["grass", "fire", "water"])).toBeNull();
  });

  it("returns null on empty", () => {
    expect(detectTemporalPattern([])).toBeNull();
  });
});

describe("formatters", () => {
  it("formats epoch-ms as a UTC date", () => {
    expect(formatTemporal(Date.UTC(2024, 0, 15))).toBe("2024-01-15");
  });

  it("appends HH:MM when asked for time", () => {
    expect(formatTemporal(Date.UTC(2024, 0, 15, 13, 45), true)).toBe(
      "2024-01-15 13:45"
    );
  });

  it("formats durations at day/hour/minute/second granularity", () => {
    expect(formatDuration(2 * 86_400_000)).toBe("2.0d");
    expect(formatDuration(3 * 3_600_000)).toBe("3.0h");
    expect(formatDuration(45 * 60_000)).toBe("45.0m");
    expect(formatDuration(30_000)).toBe("30s");
  });
});
