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
