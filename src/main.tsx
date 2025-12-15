import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Some builds reference legacy globals; define safe defaults to avoid runtime ReferenceErrors
declare global {
  // eslint-disable-next-line no-var
  var PERSONA_OPTIONS: unknown;
  // eslint-disable-next-line no-var
  var profile: unknown;
}

if (typeof globalThis.PERSONA_OPTIONS === "undefined") {
  globalThis.PERSONA_OPTIONS = [];
}

// Older embedded scripts may look for a global `profile`; provide an empty object
// so the app can render even if that legacy snippet is loaded.
if (typeof globalThis.profile === "undefined") {
  globalThis.profile = {};
}

createRoot(document.getElementById("root")!).render(<App />);
