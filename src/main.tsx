import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import {
  AVAILABLE_AVATARS,
  DEFAULT_AVATAR,
  DEFAULT_AVATARS,
  PERSONA_LIST,
  PRESET_AVATARS,
  AVATAR_CATALOG,
} from "./lib/personas";

// Some builds reference legacy globals; define safe defaults to avoid runtime ReferenceErrors
declare global {
  // eslint-disable-next-line no-var
  var PERSONA_OPTIONS: unknown;
  // eslint-disable-next-line no-var
  var PRESET_AVATARS: unknown;
  // eslint-disable-next-line no-var
  var AVAILABLE_AVATARS: unknown;
  // eslint-disable-next-line no-var
  var DEFAULT_AVATARS: unknown;
  // eslint-disable-next-line no-var
  var DEFAULT_AVATAR: unknown;
  // eslint-disable-next-line no-var
  var PERSONA_LIST: unknown;
  // eslint-disable-next-line no-var
  var profile: unknown;
  // eslint-disable-next-line no-var
  var getPersonaAccess: (() => { tier?: unknown }) | undefined;
  // eslint-disable-next-line no-var
  var handlePersonaChange: ((persona: unknown) => void) | undefined;
  // eslint-disable-next-line no-var
  var handlePersonaSelect: ((persona: unknown) => void) | undefined;
  // eslint-disable-next-line no-var
  var handlePersonaLockedSelect:
    | ((persona: unknown, access?: { tier?: unknown }) => void)
    | undefined;
  // eslint-disable-next-line no-var
  var handleAvatarSelect: ((avatar: unknown) => void) | undefined;
  // eslint-disable-next-line no-var
  var handleAvatarLockedSelect:
    | ((avatar: unknown, access?: { tier?: unknown }) => void)
    | undefined;
}

const personaCatalog = PERSONA_LIST ?? [];
const avatarCatalog = AVATAR_CATALOG ?? [];
const defaultAvatars = DEFAULT_AVATARS ?? { user: null, tutor: null };

if (typeof globalThis.PERSONA_OPTIONS === "undefined") {
  globalThis.PERSONA_OPTIONS = personaCatalog;
}

if (typeof globalThis.PRESET_AVATARS === "undefined") {
  globalThis.PRESET_AVATARS = avatarCatalog;
}

if (typeof globalThis.AVAILABLE_AVATARS === "undefined") {
  globalThis.AVAILABLE_AVATARS = avatarCatalog;
}

if (typeof globalThis.DEFAULT_AVATARS === "undefined") {
  globalThis.DEFAULT_AVATARS = defaultAvatars;
}

if (typeof globalThis.DEFAULT_AVATAR === "undefined") {
  globalThis.DEFAULT_AVATAR = DEFAULT_AVATAR ?? null;
}

if (typeof globalThis.PERSONA_LIST === "undefined") {
  globalThis.PERSONA_LIST = personaCatalog;
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

// Normalize newer persona/avatar handler names so any component variation
// resolves to the same safe no-op, preventing ReferenceErrors from
// mismatched callback props or legacy snippets.
if (typeof globalThis.handlePersonaSelect === "undefined") {
  globalThis.handlePersonaSelect = (persona) => {
    globalThis.handlePersonaChange?.(persona);
  };
}

if (typeof globalThis.handlePersonaLockedSelect === "undefined") {
  globalThis.handlePersonaLockedSelect = (persona) => {
    globalThis.handlePersonaSelect?.(persona);
  };
}

if (typeof globalThis.handleAvatarSelect === "undefined") {
  globalThis.handleAvatarSelect = () => {};
}

if (typeof globalThis.handleAvatarLockedSelect === "undefined") {
  globalThis.handleAvatarLockedSelect = (avatar) => {
    globalThis.handleAvatarSelect?.(avatar);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
