import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NumericalAxis, OrdinalAxis, TemporalAxis } from "../types";
import { formatIdentity } from "./chart/hints/HoverTooltip";
import { NaiveParallel } from "./NaiveParallel";
import { ParallelChart } from "./ParallelChart";

const data = [
  { id: 1, hp: 45, type1: "Grass" },
  { id: 2, hp: 78, type1: "Fire" },
  { id: 3, hp: 130, type1: "Water" },
];

/** Flush an rAF-throttled update (hover detection, tooltip pointer-follow). */
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

/** Brush the hp track so two of three rows survive — commits a filter. */
function brushHp(container: HTMLElement) {
  const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
  act(() => {
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("hints prop — default off", () => {
  it("renders no hint DOM and starts no idle demo when hints is omitted", () => {
    vi.useFakeTimers();
    render(<NaiveParallel data={data} />);
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByTestId("np-hint-ghost")).not.toBeInTheDocument();
    expect(screen.queryByTestId("np-hint-ghost-highlight")).not.toBeInTheDocument();
    expect(screen.queryByTestId("np-hint-counter")).not.toBeInTheDocument();
    expect(screen.queryByTestId("np-hint-tooltip")).not.toBeInTheDocument();
  });
});

describe("ghost-brush demo", () => {
  it("appears after the idle threshold and retires once a filter commits", () => {
    vi.useFakeTimers();
    const { container } = render(<NaiveParallel data={data} hints />);

    const layers = container.querySelector(".np-chart-layers")!;
    expect(screen.queryByTestId("np-hint-ghost")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByTestId("np-hint-ghost")).toBeInTheDocument();
    // the kept-rows canvas plays alongside the brush rect, and the real lines
    // dim (the filtered-out preview) while the demo is on screen
    expect(screen.getByTestId("np-hint-ghost-highlight")).toBeInTheDocument();
    expect(layers.classList.contains("np-hint-demo")).toBe(true);

    brushHp(container);
    expect(screen.queryByTestId("np-hint-ghost")).not.toBeInTheDocument();
    expect(screen.queryByTestId("np-hint-ghost-highlight")).not.toBeInTheDocument();
    expect(layers.classList.contains("np-hint-demo")).toBe(false);
  });

  it("decay is per-mount: a fresh mount plays the demo again", () => {
    vi.useFakeTimers();
    const first = render(<NaiveParallel data={data} hints />);
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByTestId("np-hint-ghost")).toBeInTheDocument();
    brushHp(first.container);
    expect(screen.queryByTestId("np-hint-ghost")).not.toBeInTheDocument();
    first.unmount();

    render(<NaiveParallel data={data} hints />);
    act(() => vi.advanceTimersByTime(1600));
    expect(screen.getByTestId("np-hint-ghost")).toBeInTheDocument();
  });
});

describe("live filter counter", () => {
  it("is hidden with no filter and shows kept / total once brushing applies one", () => {
    const { container } = render(<NaiveParallel data={data} hints />);
    expect(screen.queryByTestId("np-hint-counter")).not.toBeInTheDocument();

    brushHp(container);

    const counter = screen.getByTestId("np-hint-counter");
    expect(counter).toBeInTheDocument();
    expect(screen.getByTestId("np-hint-counter-num").textContent).toBe("2");
    expect(counter.textContent).toBe("2 / 3");
  });
});

describe("hover readout tooltip", () => {
  it("renders the hovered row's identity and values in horizontal layout", async () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart hints />
      </NaiveParallel>
    );
    const layers = container.querySelector(".np-chart-layers")!;
    // x=48 sits on the leftmost (id) axis; y=464 is row id=1's value there
    await act(async () => {
      fireEvent.pointerMove(layers, { clientX: 48, clientY: 464, pointerId: 1 });
    });
    await nextFrame();

    const tip = await screen.findByTestId("np-hint-tooltip");
    expect(tip.querySelector(".np-hint-tooltip-title")?.textContent).toBe("id: 1");
    expect(tip.textContent).toContain("45");
  });

  it("is suppressed in vertical (mobile) layout even when a row is hovered", async () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart layout="vertical" hints />
      </NaiveParallel>
    );
    const layers = container.querySelector(".np-chart-layers")!;
    await act(async () => {
      fireEvent.pointerMove(layers, { clientX: 48, clientY: 96, pointerId: 1 });
    });
    await nextFrame();

    expect(screen.queryByTestId("np-hint-tooltip")).not.toBeInTheDocument();
  });
});

describe("formatIdentity", () => {
  it("shows the full, unmapped string for a first-char-mapped ordinal id axis", () => {
    const ticker: OrdinalAxis = {
      id: "ticker",
      path: "ticker",
      label: "ticker",
      hidden: false,
      kind: "ordinal",
      values: ["A", "B"],
      cardinality: 2,
      colors: {},
      source: "string",
      mapping: (s) => s[0],
      renderable: true,
    };
    // axisValue would map "AAPL" -> "A"; the title must keep the full symbol
    expect(formatIdentity(ticker, { ticker: "AAPL" })).toBe("AAPL");
    expect(formatIdentity(ticker, {})).toBe("—");
  });

  it("formats a numerical id and a temporal id", () => {
    const id: NumericalAxis = {
      id: "id",
      path: "id",
      label: "id",
      hidden: false,
      kind: "numerical",
      domain: [1, 3],
      allIntegers: true,
      allPositive: true,
    };
    expect(formatIdentity(id, { id: 2 })).toBe("2");

    const date: TemporalAxis = {
      id: "date",
      path: "date",
      label: "date",
      hidden: false,
      kind: "temporal",
      domain: [Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 31)],
      allIntegers: true,
      allPositive: true,
      temporal: { pattern: "iso-date", source: "string" },
    };
    expect(formatIdentity(date, { date: "2024-01-15" })).toContain("2024");
  });
});
