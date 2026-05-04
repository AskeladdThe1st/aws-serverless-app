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

type AvatarIcon =
  | 'book-check'
  | 'graph-curve'
  | 'exam-target'
  | 'formula'
  | 'compass'
  | 'network'
  | 'spark';

const avatarIcons: Record<AvatarIcon, string> = {
  'book-check': `
    <path d='M27 31c8-4 17-4 25 0v34c-8-4-17-4-25 0V31Z' fill='none' stroke='white' stroke-width='5' stroke-linejoin='round'/>
    <path d='M52 31c6-4 14-4 21-1v33c-7-3-15-3-21 2V31Z' fill='none' stroke='white' stroke-width='5' stroke-linejoin='round'/>
    <path d='M36 48l7 7 15-18' fill='none' stroke='white' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>
  `,
  'graph-curve': `
    <path d='M25 68V29M24 68h48' fill='none' stroke='white' stroke-width='5' stroke-linecap='round'/>
    <path d='M29 60c10-2 12-18 22-18 9 0 10 15 22 10' fill='none' stroke='white' stroke-width='6' stroke-linecap='round'/>
    <circle cx='51' cy='42' r='5' fill='white'/>
  `,
  'exam-target': `
    <circle cx='48' cy='48' r='25' fill='none' stroke='white' stroke-width='5'/>
    <circle cx='48' cy='48' r='12' fill='none' stroke='white' stroke-width='5'/>
    <path d='M48 23v-8M48 81v-8M23 48h-8M81 48h-8' stroke='white' stroke-width='5' stroke-linecap='round'/>
    <path d='M42 49l5 5 10-13' fill='none' stroke='white' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/>
  `,
  formula: `
    <path d='M27 32h20M31 48h12M27 64h20' stroke='white' stroke-width='5' stroke-linecap='round'/>
    <path d='M57 35l13 26M70 35L57 61' stroke='white' stroke-width='6' stroke-linecap='round'/>
    <circle cx='68' cy='29' r='4' fill='white'/>
  `,
  compass: `
    <circle cx='48' cy='48' r='25' fill='none' stroke='white' stroke-width='5'/>
    <path d='M55 26L43 52 31 70l22-12 12-26-10-6Z' fill='white' opacity='.95'/>
    <circle cx='48' cy='48' r='4' fill='url(#g)'/>
  `,
  network: `
    <circle cx='29' cy='55' r='8' fill='white'/>
    <circle cx='49' cy='32' r='8' fill='white'/>
    <circle cx='68' cy='59' r='8' fill='white'/>
    <path d='M35 49l9-11M54 39l9 13M37 56l22 3' stroke='white' stroke-width='5' stroke-linecap='round' opacity='.9'/>
  `,
  spark: `
    <path d='M48 18l7 21 21 7-21 7-7 25-7-25-21-7 21-7 7-21Z' fill='white'/>
    <path d='M70 20l3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9Z' fill='white' opacity='.8'/>
  `,
};

const createAvatarDataUri = (color: string, accent: string, icon: AvatarIcon) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='${color}' />
        <stop offset='100%' stop-color='${accent}' />
      </linearGradient>
      <radialGradient id='shine' cx='30%' cy='24%' r='70%'>
        <stop offset='0%' stop-color='white' stop-opacity='.28' />
        <stop offset='100%' stop-color='white' stop-opacity='0' />
      </radialGradient>
    </defs>
    <rect width='96' height='96' rx='28' fill='url(#g)' />
    <circle cx='25' cy='20' r='34' fill='url(#shine)' />
    <path d='M12 76c18 8 42 8 72-4' stroke='white' stroke-opacity='.18' stroke-width='10' stroke-linecap='round' />
    ${avatarIcons[icon]}
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
    avatar: createAvatarDataUri('#2563eb', '#7c3aed', 'book-check'),
  },
  {
    id: 'visual',
    name: 'Visual Guide',
    description: 'Adds intuition, diagrams, and graph-first thinking.',
    detail: 'Great for conceptual explanations and quick sketches.',
    tier: 'student',
    avatar: createAvatarDataUri('#f97316', '#ef4444', 'graph-curve'),
  },
  {
    id: 'exam',
    name: 'Exam Coach',
    description: 'Fast, exam-ready steps with pitfalls and checks.',
    detail: 'Optimized for timed drills and “gotcha” reminders.',
    tier: 'pro',
    avatar: createAvatarDataUri('#059669', '#0f766e', 'exam-target'),
  },
];

export const PRESET_AVATARS: AvatarOption[] = [
  { id: 'formula-blue', label: 'Formula', url: createAvatarDataUri('#0ea5e9', '#4f46e5', 'formula') },
  { id: 'compass-sunrise', label: 'Compass', url: createAvatarDataUri('#f97316', '#ef4444', 'compass') },
  { id: 'network-green', label: 'Connected graph', url: createAvatarDataUri('#22c55e', '#059669', 'network') },
  { id: 'spark-plum', label: 'Insight spark', url: createAvatarDataUri('#8b5cf6', '#6366f1', 'spark') },
];
