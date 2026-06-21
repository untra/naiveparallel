import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

const NORMAL = 400;
const SWELL = 700;
const DURATION_MS = 220;

/** ease-out quadratic: fast swell, gentle settle back to normal weight. */
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/**
 * The shared "tasteful noticing" motif: returns a font-weight that swells to
 * ~700 whenever `value` changes, then eases back to 400 over ~220ms — drawing
 * the eye to a changing readout without moving anything. The initial mount does
 * not pulse. Under `prefers-reduced-motion` the weight stays constant. rAF is
 * cancelled on unmount and on the next change.
 *
 * v1 consumer is the filter-counter numerator; exported as a primitive so future
 * textual readouts (e.g. a stat legend) can reuse it.
 */
export function usePulseWeight(value: unknown): number {
  const reduced = usePrefersReducedMotion();
  const [weight, setWeight] = useState(NORMAL);
  const frame = useRef<number | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      // skip the pulse on initial paint — only changes are noteworthy
      firstRun.current = false;
      return;
    }
    if (reduced) return; // weight is pinned to NORMAL by the return below

    // drive the whole pulse from inside the rAF callback (the first tick sets
    // the swell), so no state is written synchronously in the effect body
    let startTs: number | null = null;
    const tick = (now: number) => {
      if (startTs === null) startTs = now;
      const t = Math.min(1, (now - startTs) / DURATION_MS);
      setWeight(Math.round(SWELL - (SWELL - NORMAL) * easeOut(t)));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        frame.current = null;
      }
    };
    frame.current = requestAnimationFrame(tick);

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [value, reduced]);

  return reduced ? NORMAL : weight;
}
