export type AvatarTier = "guest" | "free" | "student" | "pro";

export type AvatarOption = {
  id: string;
  label: string;
  kind: "user" | "tutor";
  lockedFor?: AvatarTier[];
  description?: string;
  imageUrl?: string | null;
};

// Unified catalog of avatars and tutor personas with lightweight metadata.
// Images are optional and can be wired up later without changing the shape.
export const AVATAR_CATALOG: AvatarOption[] = [
  {
    id: "classic-tutor",
    label: "Classic Tutor",
    kind: "tutor",
    description: "Default math tutor persona",
    imageUrl: null,
  },
  {
    id: "modern-tutor",
    label: "Modern Tutor",
    kind: "tutor",
    description: "Concise, exam-focused tutor persona",
    imageUrl: null,
    lockedFor: ["guest"],
  },
  {
    id: "focused-student",
    label: "Focused Student",
    kind: "user",
    description: "Clean student avatar",
    imageUrl: null,
  },
  {
    id: "honors-student",
    label: "Honors Student",
    kind: "user",
    description: "Premium student avatar",
    imageUrl: null,
    lockedFor: ["guest", "free"],
  },
];

export const USER_AVATARS = AVATAR_CATALOG.filter((avatar) => avatar.kind === "user");
export const TUTOR_PERSONAS = AVATAR_CATALOG.filter((avatar) => avatar.kind === "tutor");

export const DEFAULT_AVATARS = {
  user: USER_AVATARS[0] ?? null,
  tutor: TUTOR_PERSONAS[0] ?? null,
};

// Legacy aliases kept for backward compatibility with older references.
export const PRESET_AVATARS = AVATAR_CATALOG;
export const AVAILABLE_AVATARS = AVATAR_CATALOG;
export const PERSONA_LIST = TUTOR_PERSONAS;
export const DEFAULT_AVATAR = DEFAULT_AVATARS.user;
