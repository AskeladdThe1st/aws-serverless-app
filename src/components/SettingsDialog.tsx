import { Moon, Sun, Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelAccessState, ModelSelector } from './ModelSelector';
import { useTheme } from 'next-themes';
import { Avatar } from '@/components/ui/avatar';
import { AvatarOption, USER_AVATAR_OPTIONS, TUTOR_AVATAR_OPTIONS } from '@/config/avatars';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  modelAccess?: (modelId: string) => ModelAccessState;
  onModelLockedSelect?: (modelId: string, access: ModelAccessState) => void;
  showMoreSteps: boolean;
  onShowMoreStepsChange: (enabled: boolean) => void;
  conciseAnswers: boolean;
  onConciseAnswersChange: (enabled: boolean) => void;
  sympyVerification: boolean;
  onSympyVerificationChange: (enabled: boolean) => void;
  userAvatar?: string | null;
  tutorAvatar?: string | null;
  plan?: string;
  onUserAvatarChange?: (id: string) => void;
  onTutorAvatarChange?: (id: string) => void;
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  selectedModel,
  onModelChange,
  modelAccess,
  onModelLockedSelect,
  showMoreSteps,
  onShowMoreStepsChange,
  conciseAnswers,
  onConciseAnswersChange,
  sympyVerification,
  onSympyVerificationChange,
  userAvatar,
  tutorAvatar,
  plan,
  onUserAvatarChange,
  onTutorAvatarChange,
}: SettingsDialogProps) => {
  const { theme, setTheme } = useTheme();

  const renderAvatarOption = (option: AvatarOption, selectedId?: string | null, onSelect?: (id: string) => void) => {
    const isLocked = option.tier === 'student'
      ? (plan || '').toLowerCase() === 'guest'
      : option.tier === 'pro' && (plan || '').toLowerCase() !== 'pro';
    const selected = selectedId === option.id;

    return (
      <button
        key={option.id}
        type="button"
        onClick={() => !isLocked && onSelect?.(option.id)}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors text-left w-full ${
          selected ? 'border-primary/80 bg-primary/5' : 'border-border'
        } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/60'}`}
      >
        <Avatar className="h-9 w-9 bg-muted flex items-center justify-center text-lg">
          <span>{option.emoji}</span>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{option.label}</p>
          <p className="text-xs text-muted-foreground capitalize">{option.tier} tier</p>
        </div>
        {isLocked && <Lock className="h-4 w-4 text-muted-foreground" />}
      </button>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Theme</h3>
            <div className="flex gap-3">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light Mode
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark Mode
              </Button>
            </div>
          </div>

          {/* Solver Settings Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Solver Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-steps" className="text-sm cursor-pointer">
                  Show More Steps
                </Label>
                <Switch
                  id="show-steps"
                  checked={showMoreSteps}
                  onCheckedChange={onShowMoreStepsChange}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="concise" className="text-sm cursor-pointer">
                  Concise Answers
                </Label>
                <Switch
                  id="concise"
                  checked={conciseAnswers}
                  onCheckedChange={onConciseAnswersChange}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="sympy" className="text-sm cursor-pointer">
                  SymPy Verification
                </Label>
                <Switch
                  id="sympy"
                  checked={sympyVerification}
                  onCheckedChange={onSympyVerificationChange}
                />
              </div>
            </div>
          </div>

          {/* Model Settings Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Model Settings</h3>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Selected Model</Label>
              <ModelSelector
                value={selectedModel}
                onValueChange={onModelChange}
                accessForModel={modelAccess}
                onLockedSelect={onModelLockedSelect}
                variant="default"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Avatars</h3>
              <span className="text-xs text-muted-foreground capitalize">Plan: {plan || 'guest'}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Student avatar</p>
                {USER_AVATAR_OPTIONS.map((option) =>
                  renderAvatarOption(option, userAvatar, onUserAvatarChange)
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Tutor avatar</p>
                {TUTOR_AVATAR_OPTIONS.map((option) =>
                  renderAvatarOption(option, tutorAvatar, onTutorAvatarChange)
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
