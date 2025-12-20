export type PersonaTier = 'guest' | 'free' | 'student' | 'pro';

export interface PersonaOption {
  id: string;
  name: string;
  description: string;
  detail: string;
  tier: PersonaTier;
  avatar: string;
}

export interface AvatarOption {
  id: string;
  label: string;
  url: string;
}

const createAvatarDataUri = (color: string, accent: string, label: string) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='${color}' />
        <stop offset='100%' stop-color='${accent}' />
      </linearGradient>
    </defs>
    <rect rx='18' width='96' height='96' fill='url(#g)' />
    <text x='50%' y='55%' text-anchor='middle' font-family='Inter,Helvetica' font-size='34' fill='white' font-weight='700'>${label}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const DEFAULT_PERSONA_ID = 'classic';

export const PERSONA_OPTIONS: PersonaOption[] = [
  {
    id: 'classic',
    name: 'Classic Tutor',
    description: 'Concise, verified, and methodical solutions.',
    detail: 'Matches the standard Math Tutor Agent tone with SymPy checks.',
    tier: 'guest',
    avatar: createAvatarDataUri('#0ea5e9', '#6366f1', 'CT'),
  },
  {
    id: 'visual',
    name: 'Visual Guide',
    description: 'Adds intuition, diagrams, and graph-first thinking.',
    detail: 'Great for conceptual explanations and quick sketches.',
    tier: 'student',
    avatar: createAvatarDataUri('#f97316', '#f43f5e', 'VG'),
  },
  {
    id: 'exam',
    name: 'Exam Coach',
    description: 'Fast, exam-ready steps with pitfalls and checks.',
    detail: 'Optimized for timed drills and “gotcha” reminders.',
    tier: 'pro',
    avatar: createAvatarDataUri('#22c55e', '#14b8a6', 'EC'),
  },
];

export const PRESET_AVATARS: AvatarOption[] = [
  { id: 'cool-blue', label: 'Blue Gradient', url: createAvatarDataUri('#0ea5e9', '#6366f1', 'U') },
  { id: 'sunrise', label: 'Sunrise', url: createAvatarDataUri('#f59e0b', '#ef4444', 'U') },
  { id: 'forest', label: 'Forest', url: createAvatarDataUri('#22c55e', '#16a34a', 'U') },
  { id: 'plum', label: 'Plum', url: createAvatarDataUri('#a855f7', '#6366f1', 'U') },
];
