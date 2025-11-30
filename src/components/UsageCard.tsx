import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface UsageCardProps {
  problemsLeft: number;
  maxProblems: number;
  onSeePlans: () => void;
  onUpgrade: () => void;
  isCollapsed?: boolean;
}

export const UsageCard = ({ 
  problemsLeft, 
  maxProblems, 
  onSeePlans, 
  onUpgrade,
  isCollapsed = false 
}: UsageCardProps) => {
  const percentage = (problemsLeft / maxProblems) * 100;

  if (isCollapsed) {
    return null;
  }

  return (
    <div className="p-4 border-t border-sidebar-border space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {problemsLeft} problems left today
        </p>
        <p className="text-xs text-muted-foreground">
          Upgrade for more usage
        </p>
      </div>

      <Progress value={percentage} className="h-2" />

      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onSeePlans}
          className="flex-1 text-xs"
        >
          See plans
        </Button>
        <Button 
          size="sm" 
          onClick={onUpgrade}
          className="flex-1 text-xs"
        >
          Upgrade
        </Button>
      </div>
    </div>
  );
};
