import { NaiveParallel } from "../../naiveparallel";
import "../../naiveparallel/components/styles.css";
import mons from "../data/mons.json";

export function Home() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>🪒 naiveparallel</h1>
      <p>
        A naive react parallel coordinates plot for <code>{"Array<T>"}</code> datasets. The chart
        below is the <em>entire default UI</em> rendered from{" "}
        <code>{"<NaiveParallel data={mons} />"}</code> — 898 Pokémon and their inferred axes.
      </p>
      <NaiveParallel data={mons as any[]} />
    </main>
  );
}
