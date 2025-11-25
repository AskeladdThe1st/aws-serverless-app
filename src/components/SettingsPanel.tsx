import { X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  manualMode: boolean;
  onManualModeChange: (enabled: boolean) => void;
}

export const SettingsPanel = ({
  isOpen,
  onClose,
  manualMode,
  onManualModeChange,
}: SettingsPanelProps) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 bg-card border-l border-border z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Graph Tools Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Graph Tools</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="manual-mode" className="text-sm text-foreground cursor-pointer">
                  Manual Graph Mode
                </Label>
                <Switch
                  id="manual-mode"
                  checked={manualMode}
                  onCheckedChange={onManualModeChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                When enabled, you'll be asked clarifying questions before analyzing graphs.
              </p>
            </div>
          </div>

          {/* Solver Settings Section */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-foreground mb-4">Solver Settings</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-steps" className="text-sm text-foreground cursor-pointer">
                  Show More Steps
                </Label>
                <Switch id="show-steps" />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="concise" className="text-sm text-foreground cursor-pointer">
                  Concise Answers
                </Label>
                <Switch id="concise" />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="sympy" className="text-sm text-foreground cursor-pointer">
                  SymPy Verification
                </Label>
                <Switch id="sympy" />
              </div>
            </div>
          </div>

          {/* Practice Tools Section */}
          <div>
            <h3 className="text-sm font-medium text-foreground mb-4">Practice Tools</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start text-sm" disabled>
                Generate Practice Questions
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" disabled>
                Create Quiz from Images
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Practice tools coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
