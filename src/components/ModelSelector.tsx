import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ModelSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  variant?: 'default' | 'compact';
}

const MODELS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Balanced performance' },
  { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Enhanced reasoning' },
  { id: 'gpt-4.1-preview', name: 'GPT-4.1 Preview', description: 'Latest features' },
  { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Most capable' },
  { id: 'gpt-5.1-turbo', name: 'GPT-5.1 Turbo', description: 'Speed optimized' },
  { id: 'gpt-5.1-flash', name: 'GPT-5.1 Flash', description: 'Ultra fast' },
  { id: 'gpt-5.1-thinking', name: 'GPT-5.1 Thinking', description: 'Deep reasoning' },
];

export const ModelSelector = ({ value, onValueChange, variant = 'default' }: ModelSelectorProps) => {
  const selectedModel = MODELS.find(m => m.id === value) || MODELS[0];

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
        {MODELS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onValueChange(model.id)}
            className="flex items-start gap-2 py-2.5 cursor-pointer"
          >
            <div className="flex h-5 items-center">
              {value === model.id && <Check className="h-4 w-4" />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="text-sm font-medium">{model.name}</div>
              <div className="text-xs text-muted-foreground">{model.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
