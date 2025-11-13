import { Button } from '@/components/ui/button';
import { LogOut, LogIn, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'aws-amplify/auth';

interface OptionalAuthHeaderProps {
  onUpgradeClick?: () => void;
}

export const OptionalAuthHeader = ({ onUpgradeClick }: OptionalAuthHeaderProps) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={openAuthModal}
        className="gap-2"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign In</span>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {onUpgradeClick && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onUpgradeClick}
          className="gap-2 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
        >
          <Crown className="h-4 w-4" />
          <span className="hidden sm:inline">Upgrade</span>
        </Button>
      )}
      <span className="text-sm text-muted-foreground hidden md:inline">
        {user?.signInDetails?.loginId || user?.username}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="gap-2"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Logout</span>
      </Button>
    </div>
  );
};
