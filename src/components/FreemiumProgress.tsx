import { Progress } from '@/components/ui/progress';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FreemiumProgressProps {
  problemsSolved: number;
  limit: number;
  remaining: number;
  progress: number;
  isAuthenticated: boolean;
  onUpgradeClick?: () => void;
}

export const FreemiumProgress = ({
  problemsSolved,
  limit,
  remaining,
  progress,
  isAuthenticated,
  onUpgradeClick,
}: FreemiumProgressProps) => {
  const isWarning = remaining <= 2 && remaining > 0;
  const isLimitReached = remaining === 0;

  return (
    <div className="bg-card border-b border-border px-4 py-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn(
              'font-medium',
              isLimitReached ? 'text-destructive' : isWarning ? 'text-yellow-500' : 'text-muted-foreground'
            )}>
              {problemsSolved} / {limit} problems used
            </span>
            {!isAuthenticated && remaining > 0 && (
              <span className="text-xs text-muted-foreground">
                (Sign in for +2 bonus)
              </span>
            )}
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="text-xs font-medium text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Upgrade
            </button>
          )}
        </div>
        <Progress
          value={progress}
          className={cn(
            'h-1.5',
            isLimitReached && '[&>div]:bg-destructive',
            isWarning && '[&>div]:bg-yellow-500'
          )}
        />
      </div>
    </div>
  );
};
