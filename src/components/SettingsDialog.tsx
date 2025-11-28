import { X, Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ModelSelector } from './ModelSelector';
import { useTheme } from 'next-themes';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  showMoreSteps: boolean;
  onShowMoreStepsChange: (enabled: boolean) => void;
  conciseAnswers: boolean;
  onConciseAnswersChange: (enabled: boolean) => void;
  sympyVerification: boolean;
  onSympyVerificationChange: (enabled: boolean) => void;
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  selectedModel,
  onModelChange,
  showMoreSteps,
  onShowMoreStepsChange,
  conciseAnswers,
  onConciseAnswersChange,
  sympyVerification,
  onSympyVerificationChange,
}: SettingsDialogProps) => {
  const { theme, setTheme } = useTheme();

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
                variant="default"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
