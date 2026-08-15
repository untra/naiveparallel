import { HashRouter, Link, Route, Routes } from "react-router-dom";
import { Home } from "./routes/home";
import { Tests } from "./routes/tests";

export function App() {
  return (
    <HashRouter>
      <header className="site-header">
        <Link to="/" className="site-brand">
          🪒 naiveparallel
        </Link>
        <nav className="site-nav" aria-label="site">
          <Link to="/test">tests</Link>
          <a
            href="https://www.npmjs.com/package/@untra/naiveparallel"
            target="_blank"
            rel="noreferrer"
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
          <a
            href="https://naivetable.untra.io"
            target="_blank"
            rel="noreferrer"
          >
            🍱 naivetable
          </a>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/test" element={<Tests />} />
        <Route path="*" element={<p>404</p>} />
      </Routes>
      <footer className="footer">
        <p>
          MIT © Samuel Volin ·{" "}
          <a
            href="https://github.com/untra/naivetable"
            target="_blank"
            rel="noreferrer"
          >
            github.com/untra/naivetable
          </a>{" "}
          ·{" "}
          <a
            href="https://github.com/untra/naiveparallel"
            target="_blank"
            rel="noreferrer"
          >
            github.com/untra/naiveparallel
          </a>
        </p>
      </footer>
    </HashRouter>
  );
}
