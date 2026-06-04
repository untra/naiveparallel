import type { TemporalPatternId } from "../types";

/**
 * Date-string pattern detection and parsing for temporal axes.
 *
 * Parsing is deliberately explicit (regex + Date.UTC) — never bare
 * `Date.parse`, whose non-ISO behavior is engine-inconsistent. Date-only
 * values parse as UTC midnight so results are timezone-independent.
 */

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, june: 5, july: 6,
  august: 7, september: 8, october: 9, november: 10, december: 11,
};

/**
 * Builds a UTC timestamp, rejecting out-of-range components and calendar
 * roll-over (e.g. Feb 30 silently becoming Mar 1).
 */
function utcDate(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): number | null {
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;
  if (h > 23 || mi > 59 || s > 59) return null;
  const t = Date.UTC(y, mo, d, h, mi, s, ms);
  const dt = new Date(t);
  if (dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null; // rolled over
  return t;
}

function monthByName(name: string): number | null {
  return MONTHS[name.toLowerCase()] ?? null;
}

interface TemporalPattern {
  id: TemporalPatternId;
  re: RegExp;
  toMs(m: RegExpExecArray): number | null;
}

/** Detection order: specific before loose. */
const PATTERNS: TemporalPattern[] = [
  {
    id: "iso-datetime",
    re: /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/,
    toMs(m) {
      const [, y, mo, d, h, mi, s, frac, tz] = m;
      const ms = frac ? Number(frac.padEnd(3, "0")) : 0;
      const base = utcDate(+y, +mo - 1, +d, +h, +mi, s ? +s : 0, ms);
      if (base === null) return null;
      if (!tz || tz === "Z") return base;
      const sign = tz[0] === "-" ? -1 : 1;
      const offsetMin = sign * (+tz.slice(1, 3) * 60 + +tz.slice(4, 6));
      return base - offsetMin * 60_000;
    },
  },
  {
    id: "iso-date",
    re: /^(\d{4})-(\d{2})-(\d{2})$/,
    toMs: (m) => utcDate(+m[1], +m[2] - 1, +m[3]),
  },
  {
    id: "us-slash",
    re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    toMs: (m) => utcDate(+m[3], +m[1] - 1, +m[2]),
  },
  {
    id: "ymd-slash",
    re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
    toMs: (m) => utcDate(+m[1], +m[2] - 1, +m[3]),
  },
  {
    id: "mon-d-y",
    re: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
    toMs(m) {
      const mo = monthByName(m[1]);
      return mo === null ? null : utcDate(+m[3], mo, +m[2]);
    },
  },
  {
    id: "d-mon-y",
    re: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
    toMs(m) {
      const mo = monthByName(m[2]);
      return mo === null ? null : utcDate(+m[3], mo, +m[1]);
    },
  },
];

/**
 * Memoized string → epoch-ms parse (canvas redraws parse per row per frame).
 * Keyed by pattern + value so axes with different patterns cannot collide.
 */
const cache = new Map<string, number | null>();

/**
 * Parses a raw string against a known pattern; null when it does not conform.
 * Dates before the 1970 unix epoch are rejected (checked on the final UTC ms,
 * after any timezone-offset adjustment) — temporal axes never go negative.
 */
export function parseTemporal(pattern: TemporalPatternId, raw: string): number | null {
  const key = pattern + "\0" + raw;
  const hit = cache.get(key);
  if (hit !== undefined || cache.has(key)) return hit ?? null;
  const p = PATTERNS.find((x) => x.id === pattern)!;
  const m = p.re.exec(raw);
  const parsed = m ? p.toMs(m) : null;
  const ms = parsed !== null && parsed < 0 ? null : parsed;
  cache.set(key, ms);
  return ms;
}

/**
 * Detects whether a string column is temporal: the first value picks the
 * candidate pattern, and every value must parse with it. Null when the
 * column is not consistently date-like — including any pre-1970 value,
 * which parseTemporal rejects.
 */
export function detectTemporalPattern(values: ReadonlyArray<string>): TemporalPatternId | null {
  if (values.length === 0) return null;
  const first = values[0];
  const candidate = PATTERNS.find((p) => {
    const m = p.re.exec(first);
    return m !== null && p.toMs(m) !== null;
  });
  if (!candidate) return null;
  for (const v of values) {
    if (parseTemporal(candidate.id, v) === null) return null;
  }
  return candidate.id;
}

/**
 * Epoch-ms → "YYYY-MM-DD" (or "YYYY-MM-DD HH:MM" with time). UTC-deterministic
 * — no locale Intl — so output is stable regardless of runner timezone.
 */
export function formatTemporal(ms: number, withTime = false): string {
  const d = new Date(ms);
  const date = d.toISOString().slice(0, 10);
  return withTime ? `${date} ${d.toISOString().slice(11, 16)}` : date;
}

/** A spread in ms (e.g. a stddev) → a human duration ("2.0d", "3.0h", "45.0m", "30s"). */
export function formatDuration(ms: number): string {
  const day = 86_400_000;
  const hr = 3_600_000;
  const min = 60_000;
  if (ms >= day) return `${(ms / day).toFixed(1)}d`;
  if (ms >= hr) return `${(ms / hr).toFixed(1)}h`;
  if (ms >= min) return `${(ms / min).toFixed(1)}m`;
  return `${Math.round(ms / 1000)}s`;
}
