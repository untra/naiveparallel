import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import { deriveConfig } from "../data/deriveConfig";
import type { NumericFilter, OrdinalFilter } from "../types";
import type { Orientation } from "./chart/scales";
import { NaiveParallel } from "./NaiveParallel";
import { ParallelChart } from "./ParallelChart";
import { ParallelColumn } from "./ParallelColumn";
import { ParallelControl } from "./ParallelControl";
import { ParallelRow } from "./ParallelRow";

const data = [
  { id: 1, hp: 45, type1: "Grass" },
  { id: 2, hp: 78, type1: "Fire" },
  { id: 3, hp: 130, type1: "Water" },
];

function FilterProbe() {
  const { filters, filteredData, config } = useNaiveParallel();
  const hp = filters.hp as NumericFilter | undefined;
  const id = filters.id as NumericFilter | undefined;
  const type1 = filters.type1 as OrdinalFilter | undefined;
  return (
    <div>
      <span data-testid="probe-count">{filteredData.length}</span>
      <span data-testid="probe-hp">{hp ? `${hp.min.toFixed(0)}-${hp.max.toFixed(0)}` : "none"}</span>
      <span data-testid="probe-hp-span">{hp ? (hp.max - hp.min).toFixed(2) : "none"}</span>
      <span data-testid="probe-id">{id ? `${id.min.toFixed(0)}-${id.max.toFixed(0)}` : "none"}</span>
      <span data-testid="probe-type1">
        {type1 ? [...type1.enabled].sort().join(",") : "none"}
      </span>
      <span data-testid="probe-selected">{config.selectedAxisId ?? "none"}</span>
    </div>
  );
}

/** Flush the rAF-throttled live-brush dispatch. */
async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("brushing a numerical axis", () => {
  // chart: height 480, margins top 44 / bottom 16 -> track spans 44..464
  // hp domain [45, 130] maps 464 (low) .. 44 (high)

  it("commits a range filter on pointer-up", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });

    // invert(200) ~ 98.4, invert(464) = 45 -> keeps hp 45 and 78, drops 130
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });

  it("shows the in-flight brush rect while dragging", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 200, pointerId: 1 });
    const rect = screen.getByTestId("np-brush-hp");
    expect(rect.getAttribute("y")).toBe("100");
    expect(rect.getAttribute("height")).toBe("100");
    fireEvent.pointerUp(track, { clientY: 200, pointerId: 1 });
  });

  it("clears the filter on a click on the empty track (outside the range)", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-count").textContent).toBe("2");

    fireEvent.pointerDown(track, { clientY: 100, pointerId: 1 }); // above the 200..464 range
    fireEvent.pointerUp(track, { clientY: 101, pointerId: 1 });
    expect(screen.getByTestId("probe-hp").textContent).toBe("none");
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });

  it("selects the brushed axis (last brushed is active)", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    expect(screen.getByTestId("probe-selected").textContent).toBe("id");
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-selected").textContent).toBe("hp");
  });

  it("applies the filter live while brushing, before pointer-up", async () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    await nextFrame(); // pointer still down — the rows already updated
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });
});

describe("brushing a temporal axis", () => {
  // 'when' auto-detects as a temporal numerical axis (iso-date), so it brushes
  // through the same numeric path: domain [Jan 1, Dec 1] epoch-ms over track 44..464.
  const datedData = [
    { id: 1, when: "2024-01-01" },
    { id: 2, when: "2024-06-01" },
    { id: 3, when: "2024-12-01" },
  ];

  function TemporalProbe() {
    const { filters, filteredData } = useNaiveParallel();
    const when = filters.when as NumericFilter | undefined;
    return (
      <div>
        <span data-testid="probe-when-count">{filteredData.length}</span>
        <span data-testid="probe-when-kind">{when?.kind ?? "none"}</span>
        <span data-testid="probe-when-min">{when ? String(when.min) : "none"}</span>
        <span data-testid="probe-when-max">{when ? String(when.max) : "none"}</span>
      </div>
    );
  }

  it("commits a numeric epoch-ms filter on pointer-up", () => {
    const { container } = render(
      <NaiveParallel data={datedData}>
        <ParallelChart />
        <TemporalProbe />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-when"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });

    // invert(464) = domain min (clamped); invert(200) ~ late July — keeps Jan + Jun, drops Dec
    expect(screen.getByTestId("probe-when-kind").textContent).toBe("numeric");
    expect(Number(screen.getByTestId("probe-when-min").textContent)).toBe(Date.UTC(2024, 0, 1));
    const max = Number(screen.getByTestId("probe-when-max").textContent);
    expect(max).toBeGreaterThan(Date.UTC(2024, 5, 1));
    expect(max).toBeLessThan(Date.UTC(2024, 11, 1));
    expect(screen.getByTestId("probe-when-count").textContent).toBe("2");
  });
});

describe("brush move (grab and slide the filtered range)", () => {
  function brushed() {
    const rendered = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    const track = rendered.container.querySelector(
      '[data-testid="np-axis-hp"] .np-brush-track'
    )!;
    // commit a 200..464px brush -> hp [45, ~98.4]
    fireEvent.pointerDown(track, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    return track;
  }

  it("slides the range along the axis, preserving its size", () => {
    const track = brushed();
    const spanBefore = screen.getByTestId("probe-hp-span").textContent;
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");

    // grab inside the 200..464 extent and drag up 50px
    fireEvent.pointerDown(track, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 250, pointerId: 1 });

    // extent slid to 150..414 -> hp [~55.1, ~108.6]; span unchanged
    expect(screen.getByTestId("probe-hp").textContent).toBe("55-109");
    expect(screen.getByTestId("probe-hp-span").textContent).toBe(spanBefore);
  });

  it("shows the sliding rect with constant height while moving", () => {
    const track = brushed();
    fireEvent.pointerDown(track, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 250, pointerId: 1 });
    const rect = screen.getByTestId("np-brush-hp");
    expect(Number(rect.getAttribute("y"))).toBeCloseTo(150, 6);
    expect(Number(rect.getAttribute("height"))).toBeCloseTo(264, 6); // 464-200, preserved
    fireEvent.pointerUp(track, { clientY: 250, pointerId: 1 });
  });

  it("clamps the slide to the track ends", () => {
    const track = brushed();
    fireEvent.pointerDown(track, { clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 }); // shove far down
    const rect = screen.getByTestId("np-brush-hp");
    expect(Number(rect.getAttribute("y")) + Number(rect.getAttribute("height"))).toBe(464);
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98"); // pinned at the bottom
  });

  it("leaves the filter intact when the range is clicked without moving", () => {
    const track = brushed();
    fireEvent.pointerDown(track, { clientY: 300, pointerId: 1 }); // inside the range
    fireEvent.pointerUp(track, { clientY: 300, pointerId: 1 });
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");
  });
});

describe("multiple axes filtered at once", () => {
  it("accumulates filters across axes; the last brushed axis is the active one", async () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    // brush hp to [45, ~98] -> rows 1 (Grass) and 2 (Fire)
    const hpTrack = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(hpTrack, { clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(hpTrack, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(hpTrack, { clientY: 464, pointerId: 1 });

    // brush type1 Grass..Water -> drops Fire; only row 1 (Grass) passes both filters
    const typeTrack = container.querySelector('[data-testid="np-axis-type1"] .np-brush-track')!;
    fireEvent.pointerDown(typeTrack, { clientY: 254, pointerId: 1 });
    fireEvent.pointerMove(typeTrack, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(typeTrack, { clientY: 464, pointerId: 1 });

    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("1");

    // brush a second numerical axis (id) -> three simultaneous filters
    const idTrack = container.querySelector('[data-testid="np-axis-id"] .np-brush-track')!;
    fireEvent.pointerDown(idTrack, { clientY: 44, pointerId: 1 });
    fireEvent.pointerMove(idTrack, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(idTrack, { clientY: 464, pointerId: 1 });

    expect(screen.getByTestId("probe-id").textContent).toBe("1-3");
    expect(screen.getByTestId("probe-hp").textContent).toBe("45-98");
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("1");
    // id was brushed last, so it is the active/selected axis
    expect(screen.getByTestId("probe-selected").textContent).toBe("id");
  });
});

describe("brushing an ordinal axis", () => {
  // type1 values sort to ["Fire", "Grass", "Water"]; track 44..464 (420px),
  // scalePoint padding 0.5 -> step 140; points Fire y=114, Grass y=254, Water y=394.
  // value bands (point ± step/2): Fire 44..184, Grass 184..324, Water 324..464.

  function renderChart(extra?: React.ReactNode) {
    return render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
        {extra}
      </NaiveParallel>
    );
  }

  function typeTrack(container: HTMLElement) {
    return container.querySelector('[data-testid="np-axis-type1"] .np-brush-track')!;
  }

  it("commits a contiguous value range on pointer-up", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 254, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    // nearest points: 254 -> Grass, 464 -> Water
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });

  it("brushes down to a single value", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 394, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("1");
  });

  it("normalizes a full-range brush to no filter", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 44, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("none");
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });

  it("applies the filter live while brushing, before pointer-up", async () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 254, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    await nextFrame(); // pointer still down — the rows already updated
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });

  it("clears the filter on a click on the empty track", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 394, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Water");

    fireEvent.pointerDown(track, { clientY: 114, pointerId: 1 }); // Fire region, outside the band
    fireEvent.pointerUp(track, { clientY: 115, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("none");
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });

  it("selects the brushed axis", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 394, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-selected").textContent).toBe("type1");
  });

  it("snaps the brush rect to whole value bands while dragging", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 254, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    const rect = screen.getByTestId("np-brush-type1");
    // Grass..Water band: [254 - 70, 394 + 70]
    expect(Number(rect.getAttribute("y"))).toBeCloseTo(184, 6);
    expect(Number(rect.getAttribute("height"))).toBeCloseTo(280, 6);
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
  });

  it("slides a grabbed range along the axis, preserving the value count", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    // commit {Fire, Grass}
    fireEvent.pointerDown(track, { clientY: 44, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 254, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 254, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Fire,Grass");

    // grab inside the band (44..324) and drag down one step
    fireEvent.pointerDown(track, { clientY: 180, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 320, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 320, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });

  it("leaves the filter intact when the band is clicked without moving", () => {
    const { container } = renderChart();
    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 394, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 464, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 464, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Water");

    fireEvent.pointerDown(track, { clientY: 400, pointerId: 1 }); // inside the Water band
    fireEvent.pointerUp(track, { clientY: 400, pointerId: 1 });
    expect(screen.getByTestId("probe-type1").textContent).toBe("Water");
  });

  it("starts a fresh brush over a non-contiguous programmatic filter (no move-mode, no band rect)", () => {
    const { container } = renderChart(<NonContiguousSetter />);
    fireEvent.click(screen.getByText("set-non-contiguous"));
    expect(screen.getByTestId("probe-type1").textContent).toBe("Fire,Water");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
    // a non-contiguous set has no band to draw or grab
    expect(screen.queryByTestId("np-brush-type1")).not.toBeInTheDocument();

    const track = typeTrack(container);
    fireEvent.pointerDown(track, { clientY: 254, pointerId: 1 });
    fireEvent.pointerMove(track, { clientY: 320, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 320, pointerId: 1 });
    // a fresh brush replaces the set rather than sliding it
    expect(screen.getByTestId("probe-type1").textContent).toBe("Grass");
    expect(screen.getByTestId("probe-count").textContent).toBe("1");
  });

  it("does not toggle values from their tick labels", () => {
    renderChart();
    fireEvent.click(screen.getByText("Fire"));
    expect(screen.getByTestId("probe-type1").textContent).toBe("none");
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });
});

function NonContiguousSetter() {
  const { setFilter } = useNaiveParallel();
  return (
    <button
      onClick={() =>
        setFilter("type1", { kind: "ordinal", enabled: new Set(["Fire", "Water"]) })
      }
    >
      set-non-contiguous
    </button>
  );
}

describe("axis drag reorder", () => {
  it("commits a new axis order on pointer-up", () => {
    const { container } = render(<NaiveParallel data={data} />);
    // visible order starts id, hp, type1 across x = 48..752
    const label = container.querySelector('[data-testid="np-axis-id"] .np-axis-label')!;
    fireEvent.pointerDown(label, { clientX: 48, pointerId: 1 });
    fireEvent.pointerMove(label, { clientX: 500, pointerId: 1 });
    fireEvent.pointerUp(label, { clientX: 500, pointerId: 1 });
    const order = Array.from(container.querySelectorAll(".np-control-name")).map(
      (el) => el.textContent
    );
    expect(order).toEqual(["hp", "id", "type1"]);
  });
});

describe("StatMarkers", () => {
  it("renders the color-coded numerical markers for the selected axis", () => {
    render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByTestId("np-axis-hp").querySelector(".np-axis-label")!);
    const stats = screen.getByTestId("np-stats");
    // red max and blue min at half thickness
    expect(stats.querySelector(".np-stat-max")).toHaveAttribute("stroke", "red");
    expect(stats.querySelector(".np-stat-max")).toHaveAttribute("stroke-width", "1");
    expect(stats.querySelector(".np-stat-min")).toHaveAttribute("stroke", "blue");
    expect(stats.querySelector(".np-stat-min")).toHaveAttribute("stroke-width", "1");
    // green median, cyan mean at full thickness
    expect(stats.querySelector(".np-stat-median")).toHaveAttribute("stroke", "green");
    expect(stats.querySelector(".np-stat-median")).toHaveAttribute("stroke-width", "2");
    expect(stats.querySelector(".np-stat-mean")).toHaveAttribute("stroke", "cyan");
    // yellow IQR bracket
    expect(stats.querySelector(".np-stat-iqr")).toHaveAttribute("stroke", "yellow");
    // magenta dotted ±1σ lines
    const stddev = stats.querySelector(".np-stat-stddev")!;
    expect(stddev).toHaveAttribute("stroke", "magenta");
    expect(stddev).toHaveAttribute("stroke-dasharray", "3 3");
    expect(stddev.querySelectorAll("line")).toHaveLength(2);
  });

  it("anchors the ±1σ dotted lines on the median", () => {
    render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByTestId("np-axis-hp").querySelector(".np-axis-label")!);
    const stats = screen.getByTestId("np-stats");
    // hp values 45/78/130: median 78, sample stddev ~42.95
    // scale: domain [45,130] -> range [464,44] (clamped)
    const yOf = (v: number) => 464 + ((v - 45) / (130 - 45)) * (44 - 464);
    const median = 78;
    const sigma = Math.sqrt(((45 - 84.33) ** 2 + (78 - 84.33) ** 2 + (130 - 84.33) ** 2) / 2);
    const [hi, lo] = Array.from(
      stats.querySelectorAll<SVGLineElement>(".np-stat-stddev line")
    ).map((l) => Number(l.getAttribute("y1")));
    expect(hi).toBeCloseTo(yOf(Math.min(median + sigma, 130)), 1);
    expect(lo).toBeCloseTo(yOf(Math.max(median - sigma, 45)), 1);
  });

  it("renders a cyan mode and green median for an ordinal selection", () => {
    render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByTestId("np-axis-type1").querySelector(".np-axis-label")!);
    const stats = screen.getByTestId("np-stats");
    expect(stats.querySelector(".np-stat-mode")).toHaveAttribute("stroke", "cyan");
    expect(stats.querySelector(".np-stat-median")).toHaveAttribute("stroke", "green");
    // dispersion is reported by ParallelColumn, not drawn on-chart (it would
    // overlap the axis label)
    expect(stats.querySelector(".np-stat-dispersion")).toBeNull();
  });

  it("recolors and hides individual stats from the chart-level statMarkers config", () => {
    const config = {
      ...deriveConfig(data),
      selectedAxisId: "hp",
      statMarkers: {
        enabled: true,
        colors: { max: "#e0245e", min: "#1d9bf0", mean: false as const, stddev: false as const },
      },
    };
    render(<NaiveParallel data={data} configuration={config} />);
    const stats = screen.getByTestId("np-stats");
    // recolored max/min
    expect(stats.querySelector(".np-stat-max")).toHaveAttribute("stroke", "#e0245e");
    expect(stats.querySelector(".np-stat-min")).toHaveAttribute("stroke", "#1d9bf0");
    // hidden mean and ±1σ
    expect(stats.querySelector(".np-stat-mean")).toBeNull();
    expect(stats.querySelector(".np-stat-stddev")).toBeNull();
    // omitted keys keep their defaults
    expect(stats.querySelector(".np-stat-median")).toHaveAttribute("stroke", "green");
    expect(stats.querySelector(".np-stat-iqr")).toHaveAttribute("stroke", "yellow");
  });

  it("hides every marker when statMarkers.enabled is false", () => {
    const config = {
      ...deriveConfig(data),
      selectedAxisId: "hp",
      statMarkers: { enabled: false },
    };
    render(<NaiveParallel data={data} configuration={config} />);
    const stats = screen.getByTestId("np-stats");
    // the group remains but holds no stat glyphs
    expect(stats.querySelector("line")).toBeNull();
    expect(stats.querySelector(".np-stat-iqr")).toBeNull();
  });
});

describe("ParallelColumn", () => {
  it("reports live stats for the selected column", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <ParallelColumn />
      </NaiveParallel>
    );
    fireEvent.click(screen.getByText("hp"));
    const column = screen.getByTestId("np-column");
    expect(column.textContent).toContain("3 / 3 rows");
    expect(column.textContent).toContain("median");
    expect(column.textContent).toContain("78"); // median of 45/78/130
  });

  it("formats temporal stats as dates, with stddev as a duration", () => {
    render(
      <NaiveParallel
        data={[
          { id: 1, when: "2024-01-01" },
          { id: 2, when: "2024-06-01" },
          { id: 3, when: "2024-12-01" },
        ]}
      >
        <ParallelChart />
        <ParallelColumn />
      </NaiveParallel>
    );
    fireEvent.click(screen.getByText("when"));
    const column = screen.getByTestId("np-column");
    expect(column.textContent).toContain("2024-12-01"); // max as a date, not epoch ms
    expect(column.textContent).toContain("2024-01-01"); // min as a date
    expect(column.textContent).toMatch(/±1σ\s*\d+(\.\d+)?d/); // stddev as a day-duration
    expect(column.textContent).not.toMatch(/\d{12,}/); // no raw epoch-ms anywhere
  });

  it("supports a render-prop override", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelColumn>
          {(stats, axis) => <span data-testid="custom">{`${axis?.id}:${stats?.kind}`}</span>}
        </ParallelColumn>
      </NaiveParallel>
    );
    expect(screen.getByTestId("custom").textContent).toBe("id:numerical");
  });
});

describe("ParallelRow", () => {
  it("exposes contextual fields to the render-prop", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelRow>
          {({ filteredData, axes, selectedAxis, setSelected, selectedRow }) => (
            <div>
              <span data-testid="row-fields">
                {`${filteredData.length}|${axes.length}|${selectedAxis?.id}|${selectedRow?.id ?? "none"}`}
              </span>
              <button onClick={() => setSelected(filteredData[2])}>pin</button>
            </div>
          )}
        </ParallelRow>
      </NaiveParallel>
    );
    expect(screen.getByTestId("row-fields").textContent).toBe("3|3|id|none");
    fireEvent.click(screen.getByText("pin"));
    expect(screen.getByTestId("row-fields").textContent).toBe("3|3|id|3");
  });

  it("renders nothing without children", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelRow />
      </NaiveParallel>
    );
    expect(container.querySelector(".np-root")?.textContent).toBe("");
  });
});

describe("ParallelControl", () => {
  it("hides and shows axes", () => {
    render(<NaiveParallel data={data} />);
    expect(screen.getByTestId("np-axis-hp")).toBeInTheDocument();
    const row = screen.getByTestId("np-control-axis-hp");
    fireEvent.click(row.querySelector("input[type=checkbox]")!);
    expect(screen.queryByTestId("np-axis-hp")).not.toBeInTheDocument();
    fireEvent.click(row.querySelector("input[type=checkbox]")!);
    expect(screen.getByTestId("np-axis-hp")).toBeInTheDocument();
  });

  it("removes an axis and offers it back as addable", () => {
    render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByLabelText("remove type1"));
    expect(screen.queryByTestId("np-axis-type1")).not.toBeInTheDocument();
    const add = screen.getByLabelText("add axis") as HTMLSelectElement;
    fireEvent.change(add, { target: { value: "type1" } });
    expect(screen.getByTestId("np-axis-type1")).toBeInTheDocument();
  });

  it("reorders axes with the up/down buttons", () => {
    const { container } = render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByLabelText("move hp up"));
    const order = Array.from(container.querySelectorAll(".np-control-name")).map(
      (el) => el.textContent
    );
    expect(order).toEqual(["hp", "id", "type1"]);
  });

  it("marks temporal axes with a distinct kind indicator", () => {
    render(
      <NaiveParallel
        data={[
          { id: 1, when: "2024-01-01" },
          { id: 2, when: "2024-06-01" },
        ]}
      />
    );
    const whenKind = screen
      .getByTestId("np-control-axis-when")
      .querySelector(".np-control-kind");
    const idKind = screen.getByTestId("np-control-axis-id").querySelector(".np-control-kind");
    expect(whenKind?.textContent).toBe("cal");
    expect(idKind?.textContent).toBe("#");
  });

  it("locks colorizing to a chosen axis", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelControl />
        <ParallelRow>{({ axes: _axes }) => <ColorizeProbe />}</ParallelRow>
      </NaiveParallel>
    );
    expect(screen.getByTestId("colorize-axis").textContent).toBe("id");
    fireEvent.change(screen.getByLabelText("colorize"), { target: { value: "type1" } });
    expect(screen.getByTestId("colorize-axis").textContent).toBe("type1");
  });

  it("switches colorizing to RGB components mode", () => {
    const rgb = [
      { id: 1, hp: 0, attack: 0 },
      { id: 2, hp: 50, attack: 100 },
      { id: 3, hp: 100, attack: 0 },
    ];
    render(
      <NaiveParallel data={rgb}>
        <ParallelControl />
        <ParallelRow>{() => <ColorOfProbe row={rgb[2]} />}</ParallelRow>
      </NaiveParallel>
    );
    fireEvent.change(screen.getByLabelText("colorize"), { target: { value: "__components" } });
    expect(screen.getByTestId("colorize-mode").textContent).toBe("components");
    // channels: R = id [1,3], G = hp [0,100], B = attack [0,100]; row 3 -> 255, 255, 0
    expect(screen.getByTestId("color-of").textContent).toBe("rgb(255, 255, 0)");
  });

  it("offers components mode only with three numerical axes", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelControl />
      </NaiveParallel>
    );
    const select = screen.getByLabelText("colorize") as HTMLSelectElement;
    // data has only two numerical axes (id, hp)
    expect([...select.options].some((o) => o.value === "__components")).toBe(false);
  });
});

function ColorizeProbe() {
  const { colorizeAxis } = useNaiveParallel();
  return <span data-testid="colorize-axis">{colorizeAxis?.id}</span>;
}

function ColorOfProbe({ row }: { row: Record<string, unknown> }) {
  const { colorOf, config } = useNaiveParallel();
  return (
    <>
      <span data-testid="colorize-mode">{config.colorizeMode}</span>
      <span data-testid="color-of">{colorOf(row)}</span>
    </>
  );
}

describe("vertical layout brushing", () => {
  // layout="vertical": margins {top:16,right:24,bottom:24,left:96}, container width 800.
  // the value axis runs HORIZONTALLY over [96, 776], low-left/high-right (NOT reversed),
  // so hp domain [45,130] maps 96->45 .. 776->130. brushing is driven by clientX.

  it("commits a range filter driven by the x coordinate", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart layout="vertical" />
        <FilterProbe />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    // invert(96)=45, invert(400)=83 -> keeps hp 45 and 78, drops 130
    fireEvent.pointerDown(track, { clientX: 96, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 400, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 400, clientY: 0, pointerId: 1 });

    expect(screen.getByTestId("probe-hp").textContent).toBe("45-83");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });

  it("draws the brush rect along x/width (not y/height)", () => {
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart layout="vertical" />
      </NaiveParallel>
    );
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientX: 96, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 400, clientY: 0, pointerId: 1 });
    const rect = screen.getByTestId("np-brush-hp");
    expect(rect.getAttribute("x")).toBe("96");
    expect(rect.getAttribute("width")).toBe("304");
    expect(rect.getAttribute("height")).toBe("16"); // fixed cross-thickness
  });
});

describe("layout=auto viewport detection", () => {
  const original = { w: window.innerWidth, h: window.innerHeight };
  const setViewport = (w: number, h: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: w });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: h });
  };
  afterEach(() => setViewport(original.w, original.h));

  it("resolves to vertical on a portrait viewport", () => {
    setViewport(375, 640);
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart layout="auto" />
      </NaiveParallel>
    );
    expect(container.querySelector(".np-chart")).toHaveClass("np-layout-vertical");
  });

  it("resolves to horizontal on a landscape viewport", () => {
    setViewport(1024, 768);
    const { container } = render(
      <NaiveParallel data={data}>
        <ParallelChart layout="auto" />
      </NaiveParallel>
    );
    expect(container.querySelector(".np-chart")).toHaveClass("np-layout-horizontal");
  });
});

function LayoutToggle() {
  const [layout, setLayout] = React.useState<Orientation>("horizontal");
  return (
    <>
      <button onClick={() => setLayout((l) => (l === "horizontal" ? "vertical" : "horizontal"))}>
        flip
      </button>
      <NaiveParallel data={data}>
        <ParallelChart layout={layout} />
        <FilterProbe />
      </NaiveParallel>
    </>
  );
}

describe("toggling the layout prop", () => {
  it("re-renders in the other orientation and brushing still works", () => {
    const { container } = render(<LayoutToggle />);
    expect(container.querySelector(".np-chart")).toHaveClass("np-layout-horizontal");

    fireEvent.click(screen.getByText("flip"));
    expect(container.querySelector(".np-chart")).toHaveClass("np-layout-vertical");

    // brushing now reads the x coordinate (vertical value axis over [96, 776])
    const track = container.querySelector('[data-testid="np-axis-hp"] .np-brush-track')!;
    fireEvent.pointerDown(track, { clientX: 96, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(track, { clientX: 400, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(track, { clientX: 400, clientY: 0, pointerId: 1 });

    expect(screen.getByTestId("probe-hp").textContent).toBe("45-83");
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
  });
});
