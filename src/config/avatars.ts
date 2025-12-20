export type AvatarTier = 'free' | 'student' | 'pro';

export interface AvatarOption {
  id: string;
  label: string;
  emoji: string;
  tier: AvatarTier;
}

export const DEFAULT_USER_AVATAR_ID = 'user-default';
export const DEFAULT_TUTOR_AVATAR_ID = 'tutor-classic';

export const USER_AVATAR_OPTIONS: AvatarOption[] = [
  { id: DEFAULT_USER_AVATAR_ID, label: 'Default', emoji: '🙂', tier: 'free' },
  { id: 'user-graph', label: 'Graph Explorer', emoji: '📈', tier: 'student' },
  { id: 'user-pro', label: 'Pro Analyst', emoji: '🧠', tier: 'pro' },
];

export const TUTOR_AVATAR_OPTIONS: AvatarOption[] = [
  { id: DEFAULT_TUTOR_AVATAR_ID, label: 'Math Tutor', emoji: '📘', tier: 'free' },
  { id: 'tutor-clarity', label: 'Clarity Coach', emoji: '💡', tier: 'student' },
  { id: 'tutor-pro', label: 'Expert Mentor', emoji: '🎓', tier: 'pro' },
];

export const AVATAR_LIBRARY = {
  user: USER_AVATAR_OPTIONS,
  tutor: TUTOR_AVATAR_OPTIONS,
};

export function findAvatar(optionId: string | null | undefined, kind: 'user' | 'tutor') {
  const options = kind === 'user' ? USER_AVATAR_OPTIONS : TUTOR_AVATAR_OPTIONS;
  return options.find((o) => o.id === optionId) || options[0];
}
