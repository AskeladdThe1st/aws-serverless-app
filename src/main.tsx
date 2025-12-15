import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Some builds reference legacy persona globals; define a safe default to avoid runtime ReferenceErrors
declare global {
  // eslint-disable-next-line no-var
  var PERSONA_OPTIONS: unknown;
}

if (typeof globalThis.PERSONA_OPTIONS === "undefined") {
  globalThis.PERSONA_OPTIONS = [];
}

createRoot(document.getElementById("root")!).render(<App />);
