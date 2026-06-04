import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { Home } from "./routes/home";
import { Tests } from "./routes/tests";

export function App() {
  return (
    <HashRouter>
      <nav style={{ display: "flex", gap: "1rem", padding: "0.5rem 1rem" }}>
        <Link to="/">naiveparallel</Link>
        <Link to="/test">tests</Link>
        <a
          href="https://www.npmjs.com/package/@untra/naiveparallel"
          target="_blank"
          rel="noreferrer"
          style={{ marginLeft: "auto" }}
        >
          npm
        </a>
        <a
          href="https://github.com/untra/naiveparallel"
          target="_blank"
          rel="noreferrer"
        >
          github
        </a>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<Tests />} />
        <Route path="*" element={<p>404</p>} />
      </Routes>
    </HashRouter>
  );
}
