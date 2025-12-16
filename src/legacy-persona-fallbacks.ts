// Minimal no-op fallbacks for legacy avatar/persona globals that may be referenced
// by older snippets or cached scripts. These do not add any UI behavior and are
// only present to prevent runtime ReferenceErrors until the new flows are fully
// implemented.

const globalAny = window as Record<string, unknown>;
const noop = () => {};

const ensureGlobal = (
  key: string,
  value: unknown,
  predicate: (current: unknown) => boolean = (current) => typeof current === "undefined",
) => {
  if (predicate(globalAny[key])) {
    globalAny[key] = value;
  }
};

const noopFns = [
  "handleAvatarUpload",
  "handleAvatarSelect",
  "handlePersonaSelect",
  "handlePersonaLockedSelect",
  "handleAvatarLockedSelect",
  "handlePersonaLockedClick",
  "getPersonaAccess",
];

noopFns.forEach((fn) => ensureGlobal(fn, noop, (current) => typeof current !== "function"));

ensureGlobal("personaLocked", false);
ensureGlobal("isAvatarUploading", false);
ensureGlobal("profile", {});

const emptyArrays = [
  "PRESET_AVATARS",
  "AVAILABLE_AVATARS",
  "PERSONA_LIST",
  "DEFAULT_AVATARS",
  "PERSONA_OPTIONS",
];

emptyArrays.forEach((key) => ensureGlobal(key, []));

ensureGlobal("tutorAvatar", null);
ensureGlobal("userAvatar", null);
ensureGlobal("ProfileSettings", {});
