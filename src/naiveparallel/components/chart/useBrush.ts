import { useCallback, useEffect, useRef, useState } from "react";
import { useNaiveParallel } from "../../context/NaiveParallelContext";
import type { AxisFilter, OrdinalAxis, ParallelAxis } from "../../types";
import { isNumericAxis } from "../../types";
import { useChartLayout } from "./ChartLayoutContext";

export interface BrushState {
  /** The in-flight brush extent in pixels [top, bottom], or null. */
  extent: [number, number] | null;
  /** True while the pointer is down. */
  brushing: boolean;
  /** Pointer handlers to spread onto the brush track element. */
  handlers: {
    onPointerDown: (e: React.PointerEvent<SVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGElement>) => void;
  };
}

/** Pixel drags shorter than this clear the filter instead (a click). */
const CLICK_TOLERANCE = 3;

interface Gesture {
  /** "new" draws a fresh extent; "move" slides the committed one, size preserved. */
  mode: "new" | "move";
  startY: number;
  /** move mode (numerical): pointer offset from the extent's top edge. */
  grabOffset: number;
  /** move mode (numerical): the extent's pixel size, which never changes. */
  size: number;
  moved: boolean;
  /** move mode (ordinal): first enabled value index at grab time. */
  startIndex: number;
  /** move mode (ordinal): how many values are enabled, which never changes. */
  count: number;
}

/**
 * The enabled values as a contiguous index run [first, last] in the axis'
 * sort order, or null when the set has gaps (or strays outside the axis).
 */
export function contiguousRun(
  values: ReadonlyArray<string>,
  enabled: ReadonlySet<string>
): [number, number] | null {
  const indices: number[] = [];
  values.forEach((value, i) => {
    if (enabled.has(value)) indices.push(i);
  });
  if (indices.length === 0 || indices.length !== enabled.size) return null;
  const first = indices[0];
  const last = indices[indices.length - 1];
  return last - first + 1 === indices.length ? [first, last] : null;
}

/**
 * Pointer-event brushing for an axis track, in the spirit of the reference
 * d3.brushY ('brush end' + rAF-coalesced updates):
 *
 * - dragging an empty track draws a new range;
 * - grabbing an existing brushed range slides it along the axis, keeping
 *   its size (numerical) or its value count (ordinal);
 * - the filter applies **live** while dragging (one rAF-throttled commit
 *   per frame), so rows, stats, and markers update immediately;
 * - brushing an axis selects it (the last-brushed axis is the active one);
 * - a click on the empty track clears the filter; a click on the brushed
 *   range leaves it untouched.
 *
 * Ordinal axes filter to a **contiguous run of values**: the extent snaps to
 * whole value bands (point ± step/2) and commits the covered values as the
 * enabled set. Sliding moves in index space — never by re-inverting the
 * snapped band, whose edges sit exactly on nearest-neighbor tie points.
 */
export function useBrush(axis: ParallelAxis): BrushState {
  const { filters, setFilter, selectAxis } = useNaiveParallel();
  const layout = useChartLayout();
  const [extent, setExtent] = useState<[number, number] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<number | null>(null);
  const pendingFilter = useRef<AxisFilter | null>(null);
  const lastFilter = useRef<AxisFilter | null>(null);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  const [trackTop, trackBottom] = layout.valueExtent();
  const scale = layout.scaleOf(axis.id);

  // the pointer's position along the value axis (y horizontal, x vertical),
  // clamped to the track span — the brush is purely value-direction driven
  const localY = (e: React.PointerEvent<SVGElement>) => {
    const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
    const v = layout.valueCoord(e.clientX - rect.left, e.clientY - rect.top);
    return Math.max(trackTop, Math.min(trackBottom, v));
  };

  /** The snapped pixel band covering the value index run [first, last]. */
  const bandOf = (ordinal: OrdinalAxis, first: number, last: number): [number, number] | null => {
    const step = scale.step();
    const top = scale.y(ordinal.values[first]);
    const bottom = scale.y(ordinal.values[last]);
    if (step === null || !Number.isFinite(step) || step <= 0 || top === null || bottom === null)
      return null;
    return [top - step / 2, bottom + step / 2];
  };

  const ordinalFilterOf = (ordinal: OrdinalAxis, first: number, last: number): AxisFilter => ({
    kind: "ordinal",
    enabled: new Set(ordinal.values.slice(first, last + 1)),
  });

  /** The index run covered by a raw pixel extent (nearest value at each end). */
  const runOf = (ordinal: OrdinalAxis, pixelExtent: [number, number]): [number, number] | null => {
    const a = scale.invertPoint(pixelExtent[0]);
    const b = scale.invertPoint(pixelExtent[1]);
    if (a === null || b === null) return null;
    const i = ordinal.values.indexOf(a);
    const j = ordinal.values.indexOf(b);
    return i <= j ? [i, j] : [j, i];
  };

  const filterOf = (pixelExtent: [number, number]): AxisFilter | undefined => {
    if (axis.kind === "ordinal") {
      const run = runOf(axis, pixelExtent);
      return run ? ordinalFilterOf(axis, run[0], run[1]) : undefined;
    }
    // the extent's two value-direction pixels invert to the domain endpoints
    // (which end is the higher value depends on orientation, so order them)
    const a = scale.invert(pixelExtent[0]);
    const b = scale.invert(pixelExtent[1]);
    if (a === null || b === null) return undefined;
    return { kind: "numeric", min: Math.min(a, b), max: Math.max(a, b) };
  };

  /** rAF-throttled live filter application (port of the reference scheduleUpdate). */
  const applyLive = useCallback(
    (filter: AxisFilter | undefined) => {
      if (filter === undefined) return;
      pendingFilter.current = filter;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        if (pendingFilter.current === null) return;
        setFilter(axis.id, pendingFilter.current);
      });
    },
    [axis.id, setFilter]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      const y = localY(e);
      selectAxis(axis.id); // the brushed axis becomes the active/selected one
      lastFilter.current = null;

      const committed = filters[axis.id];
      if (isNumericAxis(axis) && committed?.kind === "numeric") {
        // the value-pixels of min/max; which is smaller depends on orientation
        const pa = scale.y(committed.max);
        const pb = scale.y(committed.min);
        if (pa !== null && pb !== null) {
          const lo = Math.min(pa, pb);
          const hi = Math.max(pa, pb);
          if (y >= lo && y <= hi) {
            // grabbed the existing range: slide it, size preserved
            gesture.current = {
              mode: "move",
              startY: y,
              grabOffset: y - lo,
              size: hi - lo,
              moved: false,
              startIndex: 0,
              count: 0,
            };
            setExtent([lo, hi]);
            return;
          }
        }
      }
      if (axis.kind === "ordinal" && committed?.kind === "ordinal") {
        // only a contiguous run is a grabbable band; gaps fall through to a new brush
        const run = contiguousRun(axis.values, committed.enabled);
        const band = run && bandOf(axis, run[0], run[1]);
        if (run && band && y >= band[0] && y <= band[1]) {
          gesture.current = {
            mode: "move",
            startY: y,
            grabOffset: y - band[0],
            size: band[1] - band[0],
            moved: false,
            startIndex: run[0],
            count: run[1] - run[0] + 1,
          };
          setExtent(band);
          return;
        }
      }
      gesture.current = {
        mode: "new",
        startY: y,
        grabOffset: 0,
        size: 0,
        moved: false,
        startIndex: 0,
        count: 0,
      };
      const run = axis.kind === "ordinal" ? runOf(axis, [y, y]) : null;
      setExtent(axis.kind === "ordinal" && run ? (bandOf(axis, run[0], run[1]) ?? [y, y]) : [y, y]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis, filters, layout, selectAxis]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      const y = localY(e);
      if (Math.abs(y - g.startY) >= CLICK_TOLERANCE) g.moved = true;

      let next: [number, number];
      let filter: AxisFilter | undefined;
      if (axis.kind === "ordinal") {
        const step = scale.step();
        let run: [number, number] | null;
        if (g.mode === "move" && step !== null && Number.isFinite(step) && step > 0) {
          // slide in index space: re-inverting the snapped band would land on
          // nearest-neighbor tie points and grow the run by one
          const shift = Math.round((y - g.startY) / step);
          const first = Math.max(0, Math.min(axis.values.length - g.count, g.startIndex + shift));
          run = [first, first + g.count - 1];
        } else {
          run = runOf(axis, [Math.min(g.startY, y), Math.max(g.startY, y)]);
        }
        if (run === null) return;
        next = bandOf(axis, run[0], run[1]) ?? [Math.min(g.startY, y), Math.max(g.startY, y)];
        filter = ordinalFilterOf(axis, run[0], run[1]);
      } else if (g.mode === "move") {
        const top = Math.max(trackTop, Math.min(trackBottom - g.size, y - g.grabOffset));
        next = [top, top + g.size];
        filter = filterOf(next);
      } else {
        next = [Math.min(g.startY, y), Math.max(g.startY, y)];
        filter = filterOf(next);
      }
      setExtent(next);
      if (filter) lastFilter.current = filter;
      // live filtering: rows in the changed range show up right away —
      // but not before a new-brush drag is distinguishable from a click
      if (g.moved) applyLive(filter);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applyLive, axis, layout]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      const g = gesture.current;
      if (g === null) return;
      gesture.current = null;
      if (frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      pendingFilter.current = null;
      const y = localY(e);
      const finalFilter = lastFilter.current;
      lastFilter.current = null;
      setExtent(null);

      if (!g.moved && Math.abs(y - g.startY) < CLICK_TOLERANCE) {
        // a click: clears the filter on the empty track, leaves a grabbed range alone
        if (g.mode === "new") setFilter(axis.id, undefined);
        return;
      }
      if (finalFilter) setFilter(axis.id, finalFilter);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [axis.id, layout, setFilter]
  );

  return {
    extent,
    brushing: extent !== null, // extent is set for the whole pointer-down..up window
    handlers: { onPointerDown, onPointerMove, onPointerUp },
  };
}
