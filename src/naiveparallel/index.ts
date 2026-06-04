// @untra/naiveparallel public API barrel.

// Side-effect import so the library build emits dist/naiveparallel.css
// (the `./styles.css` package export). Consumers import it explicitly:
//   import "@untra/naiveparallel/styles.css";
import "./components/styles.css";

export * from "./types";
export * from "./data";
export * from "./context";
export * from "./components";
