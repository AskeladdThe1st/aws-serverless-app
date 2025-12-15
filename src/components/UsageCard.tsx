import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface UsageCardProps {
  problemsLeft?: number;
  maxProblems?: number;
  onSeePlans: () => void;
  onUpgrade: () => void;
  isCollapsed?: boolean;
  statusLabel?: string;
  isUnlimited?: boolean;
  showUpgrade?: boolean;
  showSeePlans?: boolean;
}

export const UsageCard = ({
  problemsLeft,
  maxProblems,
  onSeePlans,
  onUpgrade,
  isCollapsed = false,
  statusLabel,
  isUnlimited = false,
  showUpgrade = true,
  showSeePlans = true
}: UsageCardProps) => {
  const safeMax = maxProblems || problemsLeft || 1;
  const percentage = isUnlimited ? 100 : Math.min(100, Math.max(0, ((problemsLeft ?? safeMax) / safeMax) * 100));
  const limitReached = !isUnlimited && (problemsLeft ?? 0) <= 0;

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="p-4 border-t border-sidebar-border space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {isUnlimited ? 'Unlimited problems' : `${Math.max(problemsLeft ?? 0, 0)} problems left today`}
          </p>
          {statusLabel && (
            <span className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
              {statusLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {limitReached ? 'Daily limit reached. Upgrade to continue.' : 'Upgrade for more usage'}
        </p>
      </div>

      <Progress value={percentage} className="h-2" />

      {(showUpgrade || showSeePlans) && (
        <div className="flex gap-2">
          {showSeePlans && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSeePlans}
              className="flex-1 text-xs"
            >
              See plans
            </Button>
          )}
          {showUpgrade && (
            <Button
              size="sm"
              onClick={onUpgrade}
              className="flex-1 text-xs"
            >
              Upgrade
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
