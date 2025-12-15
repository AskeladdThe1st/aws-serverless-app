import { Check, ChevronDown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type ModelTier = 'free' | 'student' | 'pro';

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  tier: ModelTier;
}

export interface ModelAccessState {
  locked: boolean;
  reason?: 'login' | 'upgrade';
  tier: ModelTier;
}

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'default' | 'compact';
  accessForModel?: (modelId: string) => ModelAccessState;
  onLockedSelect?: (modelId: string, access: ModelAccessState) => void;
}

export const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient', tier: 'free' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Balanced performance', tier: 'free' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Enhanced reasoning', tier: 'student' },
  { id: 'gpt-4.1-preview', name: 'GPT-4.1 Preview', description: 'Latest features', tier: 'student' },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Most capable', tier: 'pro' },
  { id: 'gpt-5.1-turbo', name: 'GPT-5.1 Turbo', description: 'Speed optimized', tier: 'pro' },
  { id: 'gpt-5.1-flash', name: 'GPT-5.1 Flash', description: 'Ultra fast', tier: 'pro' },
  { id: 'gpt-5.1-thinking', name: 'GPT-5.1 Thinking', description: 'Deep reasoning', tier: 'pro' },
];

export const ModelSelector = ({ value, onValueChange, variant = 'default', accessForModel, onLockedSelect }: ModelSelectorProps) => {
  const selectedModel = MODEL_OPTIONS.find(m => m.id === value) || MODEL_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline" 
          className={variant === 'compact' ? "h-9 px-3" : "h-10 px-4"}
        >
          <span className="text-sm">{selectedModel.name}</span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Select Model
        </div>
        {MODEL_OPTIONS.map((model) => {
          const access = accessForModel?.(model.id) ?? { locked: false, tier: model.tier as ModelTier };
          const locked = access.locked;
          return (
            <DropdownMenuItem
                key={model.id}
                onClick={() => {
                  if (locked) {
                    onLockedSelect?.(model.id, access);
                    return;
                  }
                  onValueChange(model.id);
                }}
              className={`flex items-start gap-2 py-2.5 ${locked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex h-5 items-center">
                {value === model.id && <Check className="h-4 w-4" />}
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="text-sm font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {locked && <Lock className="h-3 w-3" />}
                  <span>
                    {locked ? 'Upgrade to unlock' : model.description}
                  </span>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
