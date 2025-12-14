import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AnalysisModeId = 'auto' | 'hybrid';

export const ANALYSIS_MODES: { id: AnalysisModeId; name: string; description: string; cue: string }[] = [
  {
    id: 'auto',
    name: 'Auto',
    description: 'Automatic analysis',
    cue: 'Share the full problem and the solver will respond with a complete walkthrough.',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    description: 'Interactive clarifications',
    cue: 'The assistant may pause to ask focused questions before finishing the solution.',
  },
];

interface ModeSelectorProps {
  value: AnalysisModeId;
  onValueChange: (value: AnalysisModeId) => void;
}

export const ModeSelector = ({ value, onValueChange }: ModeSelectorProps) => {
  const selectedMode = ANALYSIS_MODES.find(m => m.id === value) || ANALYSIS_MODES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-3">
          <span className="text-sm">{selectedMode.name}</span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Analysis Mode
        </div>
        {ANALYSIS_MODES.map((mode) => (
          <DropdownMenuItem
            key={mode.id}
            onClick={() => onValueChange(mode.id)}
            className="flex items-start gap-2 py-2.5 cursor-pointer"
          >
            <div className="flex h-5 items-center">
              {value === mode.id && <Check className="h-4 w-4" />}
            </div>
            <div className="flex-1 space-y-0.5">
              <div className="text-sm font-medium">{mode.name}</div>
              <div className="text-xs text-muted-foreground">{mode.description}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
