import { X, Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelAccessState, ModelSelector } from './ModelSelector';
import { ProfileSettings } from './ProfileSettings';
import { AvatarOption, PersonaOption } from './personas';
import { useTheme } from 'next-themes';

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
  personaOptions: PersonaOption[];
  selectedPersona: string;
  onPersonaChange: (personaId: string) => void;
  personaAccess?: (personaId: string) => { locked: boolean; reason?: 'login' | 'upgrade'; tier?: string };
  onPersonaLockedSelect?: (personaId: string, access?: { locked: boolean; reason?: 'login' | 'upgrade'; tier?: string }) => void;
  avatarOptions: AvatarOption[];
  selectedAvatar?: string;
  onAvatarSelect: (avatarUrl: string) => void;
  onAvatarUpload: (file: File) => void;
  isUploadingAvatar?: boolean;
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
}: SettingsDialogProps) => {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-[720px]">
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
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground block pb-0.5">Selected Model</Label>
              <ModelSelector
                value={selectedModel}
                onValueChange={onModelChange}
                accessForModel={modelAccess}
                onLockedSelect={onModelLockedSelect}
                variant="default"
              />
            </div>
          </div>

          {/* Profile Settings */}
          <ProfileSettings
            personaOptions={personaOptions}
            selectedPersona={selectedPersona}
            onPersonaChange={onPersonaChange}
            personaAccess={personaAccess}
            onPersonaLockedSelect={onPersonaLockedSelect}
            avatarOptions={avatarOptions}
            selectedAvatar={selectedAvatar}
            onAvatarSelect={onAvatarSelect}
            onAvatarUpload={onAvatarUpload}
            isUploadingAvatar={isUploadingAvatar}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
