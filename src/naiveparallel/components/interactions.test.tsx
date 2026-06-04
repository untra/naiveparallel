import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import type { NumericFilter } from "../types";
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
  const { filters, filteredData } = useNaiveParallel();
  const hp = filters.hp as NumericFilter | undefined;
  return (
    <div>
      <span data-testid="probe-count">{filteredData.length}</span>
      <span data-testid="probe-hp">{hp ? `${hp.min.toFixed(0)}-${hp.max.toFixed(0)}` : "none"}</span>
    </div>
  );
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

  it("clears the filter on a click (no drag)", () => {
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

    fireEvent.pointerDown(track, { clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(track, { clientY: 301, pointerId: 1 });
    expect(screen.getByTestId("probe-hp").textContent).toBe("none");
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });
});

describe("toggling ordinal values", () => {
  it("disables a value from its tick label", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelChart />
        <FilterProbe />
      </NaiveParallel>
    );
    fireEvent.click(screen.getByText("Fire"));
    expect(screen.getByTestId("probe-count").textContent).toBe("2");
    fireEvent.click(screen.getByText("Fire")); // toggle back on
    expect(screen.getByTestId("probe-count").textContent).toBe("3");
  });
});

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
  it("renders the six color-coded numerical markers for the selected axis", () => {
    const { container } = render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByTestId("np-axis-hp").querySelector(".np-axis-label")!);
    const stats = screen.getByTestId("np-stats");
    expect(stats.querySelector(".np-stat-max")).toHaveAttribute("stroke", "red");
    expect(stats.querySelector(".np-stat-mean")).toHaveAttribute("stroke", "green");
    expect(stats.querySelector(".np-stat-median")).toHaveAttribute("stroke", "blue");
    expect(stats.querySelector(".np-stat-stddev")).toHaveAttribute("fill", "yellow");
    expect(stats.querySelector(".np-stat-iqr")).toHaveAttribute("stroke", "cyan");
    expect(stats.querySelector(".np-stat-min")).toHaveAttribute("stroke", "magenta");
    expect(container).toBeTruthy();
  });

  it("renders mode/median/dispersion for an ordinal selection", () => {
    render(<NaiveParallel data={data} />);
    fireEvent.click(screen.getByTestId("np-axis-type1").querySelector(".np-axis-label")!);
    const stats = screen.getByTestId("np-stats");
    expect(stats.querySelector(".np-stat-mode")).not.toBeNull();
    expect(stats.querySelector(".np-stat-dispersion")?.textContent).toMatch(/^H /);
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
});

function ColorizeProbe() {
  const { colorizeAxis } = useNaiveParallel();
  return <span data-testid="colorize-axis">{colorizeAxis?.id}</span>;
}
