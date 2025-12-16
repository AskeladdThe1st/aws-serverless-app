import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ANALYSIS_MODES, AnalysisModeId } from './ModeSelector';

interface ModeStatusProps {
  value: AnalysisModeId;
  onValueChange: (value: AnalysisModeId) => void;
  awaitingClarification?: boolean;
}

export const ModeStatus = ({ value, onValueChange, awaitingClarification }: ModeStatusProps) => {
  const activeMode = ANALYSIS_MODES.find(mode => mode.id === value) || ANALYSIS_MODES[0];

  const helperText = awaitingClarification && value === 'hybrid'
    ? 'Answer the latest clarifying question to continue the step-by-step solution.'
    : activeMode.cue;

  return (
    <Card className="border-border bg-card/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-full px-2 py-1 text-xs font-semibold">
              Active Mode
            </Badge>
            <CardTitle className="text-base font-semibold leading-none text-foreground">
              {activeMode.name}
            </CardTitle>
            <span className="text-sm text-muted-foreground">Controls how the assistant behaves.</span>
          </div>
          <ToggleGroup
            type="single"
            value={value}
            onValueChange={(mode) => mode && onValueChange(mode as AnalysisModeId)}
            className="inline-flex rounded-full bg-muted/60 p-1"
          >
            {ANALYSIS_MODES.map((mode) => (
              <ToggleGroupItem
                key={mode.id}
                value={mode.id}
                className="rounded-full px-3 py-1 text-sm data-[state=on]:bg-background data-[state=on]:shadow"
                aria-label={`Switch to ${mode.name} mode`}
              >
                {mode.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Info className="h-4 w-4 mt-0.5 text-primary" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{activeMode.description}</p>
            <p className="text-xs leading-relaxed">{helperText}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
