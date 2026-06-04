import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useNaiveParallel } from "../context/NaiveParallelContext";
import { deriveConfig } from "../data/deriveConfig";
import type { DataObj } from "../types";
import { NaiveParallel } from "./NaiveParallel";
import { ParallelChart } from "./ParallelChart";

const data = [
  { id: 1, hp: 45, type1: "Grass" },
  null, // null rows are guarded
  { id: 2, hp: 78, type1: "Fire" },
  { id: 3, hp: 130, type1: "Water" },
];

describe("NaiveParallel", () => {
  it("renders the full default UI from data alone (no children)", () => {
    render(<NaiveParallel data={data} />);
    expect(screen.getByTestId("np-chart")).toBeInTheDocument();
    expect(screen.getByTestId("np-lines-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("np-axis-id")).toBeInTheDocument();
    expect(screen.getByTestId("np-axis-hp")).toBeInTheDocument();
    expect(screen.getByTestId("np-axis-type1")).toBeInTheDocument();
  });

  it("renders compound children instead of the default UI", () => {
    function Probe() {
      const { data: rows, filteredData } = useNaiveParallel();
      return <span data-testid="probe">{`${rows.length}/${filteredData.length}`}</span>;
    }
    render(
      <NaiveParallel data={data}>
        <Probe />
      </NaiveParallel>
    );
    expect(screen.getByTestId("probe").textContent).toBe("3/3");
    expect(screen.queryByTestId("np-chart")).not.toBeInTheDocument();
  });

  it("renders axis ticks for ordinal values and numeric ranges", () => {
    render(
      <NaiveParallel data={data}>
        <ParallelChart />
      </NaiveParallel>
    );
    const type1 = screen.getByTestId("np-axis-type1");
    expect(type1.textContent).toContain("Fire");
    expect(type1.textContent).toContain("Water");
  });

  it("selects an axis when its label is clicked", () => {
    render(<NaiveParallel data={data} />);
    const hpAxis = screen.getByTestId("np-axis-hp");
    expect(hpAxis.getAttribute("class")).not.toContain("np-axis-selected");
    fireEvent.click(hpAxis.querySelector(".np-axis-label")!);
    expect(screen.getByTestId("np-axis-hp").getAttribute("class")).toContain("np-axis-selected");
  });

  it("honors an explicit axis domain from inferOptions overrides", () => {
    render(
      <NaiveParallel
        data={data}
        inferOptions={{ overrides: { hp: { domain: [0, 255] } } }}
      >
        <ParallelChart />
      </NaiveParallel>
    );
    // ticks come from the configured [0, 255] domain, not the 45..130 data extent
    const hpAxis = screen.getByTestId("np-axis-hp");
    expect(hpAxis.textContent).toContain("250");
    expect(hpAxis.textContent).toContain("0");
  });

  it("honors an explicit axis domain from a full configuration", () => {
    const config = deriveConfig(data.filter((d) => d != null) as DataObj[]);
    const axes = config.axes.map((axis) =>
      axis.id === "hp" && axis.kind === "numerical"
        ? { ...axis, domain: [40, 90] as [number, number] }
        : axis
    );
    render(
      <NaiveParallel data={data} configuration={{ ...config, axes }}>
        <ParallelChart />
      </NaiveParallel>
    );
    const hpAxis = screen.getByTestId("np-axis-hp");
    expect(hpAxis.textContent).toContain("90");
    expect(hpAxis.textContent).not.toContain("130"); // data max beyond the configured top
  });

  it("does not render hidden or unrenderable axes", () => {
    const rows = [
      { id: 1, url: "https://example.com/a.png" },
      { id: 2, url: "https://example.com/b.png" },
    ];
    render(<NaiveParallel data={rows} />);
    expect(screen.getByTestId("np-axis-id")).toBeInTheDocument();
    expect(screen.queryByTestId("np-axis-url")).not.toBeInTheDocument();
  });
});
