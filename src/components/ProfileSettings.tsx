import { AvatarOption, PersonaOption } from './personas';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Lock, UploadCloud } from 'lucide-react';
import { useRef } from 'react';

interface PersonaAccessState {
  locked: boolean;
  reason?: 'login' | 'upgrade';
  tier?: string;
}

interface ProfileSettingsProps {
  personaOptions: PersonaOption[];
  selectedPersona: string;
  onPersonaChange: (personaId: string) => void;
  personaAccess?: (personaId: string) => PersonaAccessState;
  onPersonaLockedSelect?: (personaId: string, access?: PersonaAccessState) => void;
  avatarOptions: AvatarOption[];
  selectedAvatar?: string;
  onAvatarSelect: (url: string) => void;
  onAvatarUpload: (file: File) => void;
  isUploadingAvatar?: boolean;
}

export const ProfileSettings = ({
  personaOptions,
  selectedPersona,
  onPersonaChange,
  personaAccess,
  onPersonaLockedSelect,
  avatarOptions,
  selectedAvatar,
  onAvatarSelect,
  onAvatarUpload,
  isUploadingAvatar,
}: ProfileSettingsProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerUpload = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onAvatarUpload(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Tutor persona</h3>
          <p className="text-xs text-muted-foreground">Locked personas require higher plans.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {personaOptions.map((persona) => {
            const access = personaAccess?.(persona.id);
            const locked = access?.locked;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => {
                  if (locked) {
                    onPersonaLockedSelect?.(persona.id, access);
                    return;
                  }
                  onPersonaChange(persona.id);
                }}
                className={cn(
                  'group relative rounded-xl border p-4 text-left transition-all',
                  selectedPersona === persona.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shadow-sm">
                    <AvatarImage src={persona.avatar} alt={persona.name} />
                    <AvatarFallback>{persona.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground">{persona.name}</p>
                      <Badge variant="secondary" className="text-[11px] capitalize">
                        {persona.tier === 'guest' ? 'free' : persona.tier}
                      </Badge>
                      {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{persona.description}</p>
                    <p className="text-xs text-muted-foreground/80">{persona.detail}</p>
                  </div>
                </div>
                {locked && (
                  <div className="absolute inset-0 rounded-xl bg-background/70 backdrop-blur-[2px] border border-border flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">{access?.reason === 'login' ? 'Sign in to unlock' : 'Upgrade to unlock'}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Your avatar</h3>
          <p className="text-xs text-muted-foreground">Choose a preset or upload a custom image.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {avatarOptions.map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              onClick={() => onAvatarSelect(avatar.url)}
              className={cn(
                'relative rounded-full p-[2px] transition-all',
                selectedAvatar === avatar.url ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border border-border'
              )}
              aria-label={avatar.label}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatar.url} alt={avatar.label} />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </button>
          ))}
          <button
            type="button"
            onClick={triggerUpload}
            className="flex items-center gap-2 rounded-full border border-dashed border-border px-3 py-2 text-sm text-foreground hover:border-primary/60 transition-colors"
            aria-label="Upload custom avatar"
          >
            <UploadCloud className="h-4 w-4" />
            {isUploadingAvatar ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
};
