// Minimal no-op fallbacks for legacy avatar/persona globals that may be referenced
// by older snippets or cached scripts. These do not add any UI behavior and are
// only present to prevent runtime ReferenceErrors until the new flows are fully
// implemented.

const globalAny = window as Record<string, unknown>;
const noop = () => {};

if (typeof globalAny.handleAvatarUpload !== "function") {
  globalAny.handleAvatarUpload = noop;
}

if (typeof globalAny.handleAvatarSelect !== "function") {
  globalAny.handleAvatarSelect = noop;
}

if (typeof globalAny.handlePersonaSelect !== "function") {
  globalAny.handlePersonaSelect = noop;
}

if (typeof globalAny.handlePersonaLockedSelect !== "function") {
  globalAny.handlePersonaLockedSelect = noop;
}

if (typeof globalAny.personaLocked === "undefined") {
  globalAny.personaLocked = false;
}

if (typeof globalAny.PRESET_AVATARS === "undefined") {
  globalAny.PRESET_AVATARS = [];
}

if (typeof globalAny.AVAILABLE_AVATARS === "undefined") {
  globalAny.AVAILABLE_AVATARS = [];
}

if (typeof globalAny.PERSONA_LIST === "undefined") {
  globalAny.PERSONA_LIST = [];
}

if (typeof globalAny.DEFAULT_AVATARS === "undefined") {
  globalAny.DEFAULT_AVATARS = [];
}

if (typeof globalAny.tutorAvatar === "undefined") {
  globalAny.tutorAvatar = null;
}

if (typeof globalAny.userAvatar === "undefined") {
  globalAny.userAvatar = null;
}
