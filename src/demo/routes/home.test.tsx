import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Home } from "./home";

describe("Home dataset gallery", () => {
  it("shows six live dataset tiles plus the upload tile", async () => {
    render(<Home />);
    const group = screen.getByRole("group", { name: "datasets" });
    const tiles = group.querySelectorAll("button");
    expect(tiles).toHaveLength(7); // six datasets + load-your-own
    expect(group.querySelectorAll("button[disabled]")).toHaveLength(0);
    await waitFor(() => screen.getByTestId("np-chart"), { timeout: 5000 }); // pokemon auto-loads
  });

  it("auto-loads the Pokémon preset with its type-colored config", async () => {
    render(<Home />);
    await waitFor(() => screen.getByTestId("np-chart"), { timeout: 5000 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("Pokémon");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("898 rows");
    // preset order leads with generation (axes appear one layout tick after the chart div)
    await waitFor(() => screen.getByTestId("np-axis-generation"), { timeout: 5000 });
    expect(screen.queryByTestId("np-axis-name.en")).not.toBeInTheDocument(); // hidden by preset
  });

  it("switches datasets on tile click", async () => {
    render(<Home />);
    await waitFor(() => screen.getByTestId("np-chart"), { timeout: 5000 });
    fireEvent.click(screen.getByText("Cars"));
    await waitFor(() => screen.getByTestId("np-axis-Origin"), { timeout: 5000 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("406 rows");
    expect(screen.queryByTestId("np-axis-generation")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("MLB batting 2012"));
    await waitFor(() => screen.getByTestId("np-axis-HR"), { timeout: 5000 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("453 rows");
  });

  it("loads a custom CSV with a derived config", async () => {
    render(<Home />);
    await waitFor(() => screen.getByTestId("np-chart"), { timeout: 5000 });
    const file = new File(["x,y,kind\n1,10,a\n2,20,b\n3,30,a\n"], "mine.csv", {
      type: "text/csv",
    });
    fireEvent.change(screen.getByLabelText("upload dataset"), { target: { files: [file] } });
    await waitFor(() => screen.getByTestId("np-axis-kind"), { timeout: 5000 });
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("mine.csv");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain("3 rows");
    expect(screen.getByTestId("np-axis-x")).toBeInTheDocument();
  });

  it("surfaces upload errors inline without losing the current chart", async () => {
    render(<Home />);
    await waitFor(() => screen.getByTestId("np-chart"), { timeout: 5000 });
    const file = new File(['{"not": "an array"}'], "bad.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("upload dataset"), { target: { files: [file] } });
    await waitFor(() => screen.getByRole("alert"), { timeout: 5000 });
    expect(screen.getByRole("alert").textContent).toContain("top-level array");
    expect(screen.getByTestId("np-chart")).toBeInTheDocument(); // pokemon still shown
  });
});
