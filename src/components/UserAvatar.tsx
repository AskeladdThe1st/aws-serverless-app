import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Crown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { LoginModal } from './LoginModal';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  isCollapsed?: boolean;
}

export const UserAvatar = ({ isCollapsed = false }: UserAvatarProps) => {
  const { user, logout } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  const handleAvatarClick = () => {
    if (!user) {
      setShowLoginModal(true);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  if (!user) {
    return (
      <>
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          onClick={handleAvatarClick}
          className={cn(
            'transition-opacity hover:opacity-70',
            isCollapsed ? 'w-10 h-10' : 'w-full justify-start gap-2'
          )}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-muted">
              <User className="h-4 w-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && <span className="text-sm text-foreground">Sign in</span>}
        </Button>
        <LoginModal open={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={isCollapsed ? 'icon' : 'default'}
          className={cn(
            'transition-opacity hover:opacity-70',
            isCollapsed ? 'w-10 h-10' : 'w-full justify-start gap-2'
          )}
        >
          <Avatar className="h-8 w-8">
            {user.picture ? (
              <AvatarImage src={user.picture} alt={user.name || user.email} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground">
                {(user.name || user.email).charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          {!isCollapsed && (
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-sm text-foreground truncate max-w-full">
                {user.name || user.email}
              </span>
              {user.isPremium && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  Premium
                </span>
              )}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-foreground hover:bg-bg-hover"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
