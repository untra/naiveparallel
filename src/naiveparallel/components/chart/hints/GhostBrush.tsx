import React, { useEffect, useRef, useState } from "react";
import { useNaiveParallel } from "../../../context/NaiveParallelContext";
import { useChartLayout } from "../ChartLayoutContext";
import type { Orientation } from "../scales";
import { GhostHighlightCanvas } from "./GhostHighlightCanvas";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** How far along the track the demo brush grows (fraction of the value extent). */
const PEAK = 0.35;
/** Half-thickness across the axis line, matching the real brush rect. */
const HALF = 8;
const IDLE_MS = 1500;
const GROW_MS = 700;
const HOLD_MS = 300;
const RELEASE_MS = 320;
const GAP_MS = 2600;
const MAX_PLAYS = 2;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** SVG rect for a ghost brush centred on the track, sized to `fraction` of it. */
function ghostRect(orientation: Orientation, axisPos: number, lo: number, hi: number, fraction: number) {
  const center = (lo + hi) / 2;
  const len = Math.abs(hi - lo) * Math.max(0, Math.min(1, fraction));
  const a = center - len / 2;
  return orientation === "vertical"
    ? { x: a, width: len, y: axisPos - HALF, height: HALF * 2 }
    : { x: axisPos - HALF, width: HALF * 2, y: a, height: len };
}

/**
 * Teaches the brush gesture: after a short idle on mount, the active axis track
 * plays a one-shot translucent brush that grows from a point then releases,
 * repeating at most twice. Permanently stops once the user actually brushes
 * (any filter commits). Non-interactive (pointer-events: none) so it never
 * intercepts the real gesture. Under prefers-reduced-motion the animation is
 * replaced by a single static faint brush hint.
 */
export function GhostBrush({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const layout = useChartLayout();
  const { selectedAxis, filters } = useNaiveParallel();
  const reduced = usePrefersReducedMotion();
  const hasFilter = Object.keys(filters).length > 0;

  const axis = selectedAxis ?? layout.visibleAxes[0] ?? null;
  // null = nothing shown; otherwise the fraction of the track currently brushed
  const [fraction, setFraction] = useState<number | null>(null);
  // permanently retire the demo the moment the user brushes for real; derived
  // during render so it survives the filter later being cleared
  const [retired, setRetired] = useState(false);
  if (hasFilter && !retired) setRetired(true);

  const idleTimer = useRef<number | null>(null);
  const stepTimer = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const plays = useRef(0);

  // animated demo (skipped under reduced motion, which renders a static hint)
  useEffect(() => {
    if (reduced || retired || !axis) return;

    const animate = (from: number, to: number, ms: number, onDone: () => void) => {
      let startTs: number | null = null;
      // set the target up front so the hint is present even if rAF is throttled
      setFraction(to);
      const tick = (now: number) => {
        if (startTs === null) startTs = now;
        const t = Math.min(1, (now - startTs) / ms);
        setFraction(from + (to - from) * easeInOut(t));
        if (t < 1) frame.current = requestAnimationFrame(tick);
        else {
          frame.current = null;
          onDone();
        }
      };
      frame.current = requestAnimationFrame(tick);
    };

    const release = () => {
      animate(PEAK, 0, RELEASE_MS, () => {
        setFraction(null);
        plays.current += 1;
        if (plays.current < MAX_PLAYS) {
          stepTimer.current = window.setTimeout(play, GAP_MS);
        }
      });
    };

    const play = () => {
      if (plays.current >= MAX_PLAYS) return;
      animate(0, PEAK, GROW_MS, () => {
        stepTimer.current = window.setTimeout(release, HOLD_MS);
      });
    };

    const scheduleIdle = () => {
      if (idleTimer.current !== null) clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(play, IDLE_MS);
    };

    scheduleIdle();

    // any pointer activity before the demo has fired pushes the idle timer back
    const node = containerRef.current;
    const onActivity = () => {
      if (plays.current > 0) return;
      scheduleIdle();
    };
    node?.addEventListener("pointermove", onActivity);
    node?.addEventListener("pointerdown", onActivity);

    return () => {
      if (idleTimer.current !== null) clearTimeout(idleTimer.current);
      if (stepTimer.current !== null) clearTimeout(stepTimer.current);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      node?.removeEventListener("pointermove", onActivity);
      node?.removeEventListener("pointerdown", onActivity);
    };
  }, [reduced, retired, axis, containerRef]);

  // while the demo brush is on screen, dim the real lines (the filtered-out
  // recede) so the in-range rows drawn by GhostHighlightCanvas read as kept
  const demoVisible = !!axis && !retired && (reduced ? true : fraction !== null);
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !demoVisible) return;
    node.classList.add("np-hint-demo");
    return () => node.classList.remove("np-hint-demo");
  }, [demoVisible, containerRef]);

  if (!axis || retired) return null;

  // reduced motion: a single static faint brush, no timers or animation
  const shown = reduced ? PEAK : fraction;
  if (shown === null) return null;

  const axisPos = layout.axisPos(axis.id);
  const [lo, hi] = layout.valueExtent();

  return (
    <>
      {/* in-range rows brighten as if selected in, beneath the translucent rect */}
      <GhostHighlightCanvas axis={axis} fraction={shown} />
      <svg
        className="np-hint-ghost-layer"
        width={layout.width}
        height={layout.height}
        style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
        aria-hidden
      >
        <rect
          className="np-hint-ghost"
          data-testid="np-hint-ghost"
          {...ghostRect(layout.orientation, axisPos, lo, hi, shown)}
        />
      </svg>
    </>
  );
}
