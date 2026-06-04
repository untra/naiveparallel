import "@testing-library/jest-dom/vitest";

// jsdom has no canvas implementation; stub enough of the 2d context for
// LinesCanvas render paths. Pixel output is intentionally untested.
const noop = () => undefined;
const ctx2dStub = {
  save: noop,
  restore: noop,
  scale: noop,
  clearRect: noop,
  beginPath: noop,
  moveTo: noop,
  lineTo: noop,
  stroke: noop,
  setTransform: noop,
  canvas: null as unknown as HTMLCanvasElement,
  globalAlpha: 1,
  strokeStyle: "",
  lineWidth: 1,
};

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  ctx2dStub.canvas = this;
  return ctx2dStub;
} as unknown as typeof HTMLCanvasElement.prototype.getContext;

// jsdom has no ResizeObserver and measures every element at width 0; report a
// fixed 800px so ParallelChart computes a real layout in tests.
class ResizeObserverStub {
  private readonly callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    this.callback(
      [{ target, contentRect: { width: 800, height: 480 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver
    );
  }
  unobserve() {}
  disconnect() {}
}
(globalThis as any).ResizeObserver = ResizeObserverStub;
