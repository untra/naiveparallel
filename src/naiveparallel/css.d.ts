// Ambient module declaration so the library typecheck (tsconfig.build.json,
// which doesn't load vite/client types) accepts the styles.css side-effect import.
declare module "*.css";
