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
  var getPersonaAccess: (() => { tier?: unknown }) | undefined;
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

// Some snippets check persona access; provide a safe default that reports a guest tier
// so calls don't throw if the helper isn't defined yet.
if (typeof globalThis.getPersonaAccess === "undefined") {
  globalThis.getPersonaAccess = () => ({ tier: "guest" });
}

// Some legacy snippets expect a global handler. Provide a harmless default
// so app startup doesn't crash if those scripts are still referenced.
if (typeof globalThis.handlePersonaChange === "undefined") {
  globalThis.handlePersonaChange = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
