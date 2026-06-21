import type { DataObj } from "../../naiveparallel";
import typeColors from "../data/typeColors.json";
import { presetConfig } from "./presetConfig";
import type { DemoDataset } from "./types";

const colors = typeColors as Record<string, string>;

/**
 * The flagship dataset: 898 Pokémon. The preset reproduces the ../parallel
 * reference rendering — [0,255] stat domains, [1,9] generations, canonical
 * type colors, lines colorized by type1.
 */
export const pokemon: DemoDataset = {
  id: "pokemon",
  sourceFile: "pokemon.tsx",
  title: "Pokémon",
  description: "898 Pokémon × 6 base stats, types, and generations",
  load: () => import("../data/mons.json").then((m) => m.default as DataObj[]),
  makeConfig: (rows) =>
    presetConfig(rows, {
      inferOptions: {
        overrides: {
          generation: { domain: [1, 9] },
          "stats.hp": { domain: [0, 255], label: "hp" },
          "stats.attack": { domain: [0, 255], label: "attack" },
          "stats.defense": { domain: [0, 255], label: "defense" },
          "stats.spAttack": { domain: [0, 255], label: "spAttack" },
          "stats.spDefense": { domain: [0, 255], label: "spDefense" },
          "stats.speed": { domain: [0, 255], label: "speed" },
          type1: { colors },
          type2: { colors },
        },
      },
      order: [
        "generation",
        "id",
        "stats.hp",
        "stats.attack",
        "stats.defense",
        "stats.spAttack",
        "stats.spDefense",
        "stats.speed",
        "type1",
        "type2",
      ],
      hide: ["name.*", "image.*"],
      select: "stats.hp",
      colorizeLock: "type1",
    }),
  renderRow: (row) => (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      <img src={row.image?.sprite} alt={row.name?.en} width={96} height={96} />
      <div>
        <strong>{row.name?.en}</strong> #{row.id}
        <br />
        {row.type1}
        {row.type2 !== row.type1 ? ` / ${row.type2}` : ""} · gen {row.generation}
      </div>
    </div>
  ),
};
