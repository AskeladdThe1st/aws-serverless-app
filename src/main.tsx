import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Some builds reference legacy globals; define safe defaults to avoid runtime ReferenceErrors
declare global {
  // eslint-disable-next-line no-var
  var PERSONA_OPTIONS: unknown;
  // eslint-disable-next-line no-var
  var profile: unknown;
  // eslint-disable-next-line no-var
  var handlePersonaChange: ((persona: unknown) => void) | undefined;
}

if (typeof globalThis.PERSONA_OPTIONS === "undefined") {
  globalThis.PERSONA_OPTIONS = [];
}

// Older embedded scripts may look for a global `profile`; provide an empty object
// so the app can render even if that legacy snippet is loaded.
if (typeof globalThis.profile === "undefined") {
  globalThis.profile = {};
}

// Some legacy snippets expect a global handler. Provide a harmless default
// so app startup doesn't crash if those scripts are still referenced.
if (typeof globalThis.handlePersonaChange === "undefined") {
  globalThis.handlePersonaChange = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
