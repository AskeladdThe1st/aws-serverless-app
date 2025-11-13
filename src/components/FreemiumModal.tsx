import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Lock, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface FreemiumModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  isAuthenticated: boolean;
}

export const FreemiumModal = ({ open, onClose, onUpgrade, isAuthenticated }: FreemiumModalProps) => {
  const { openAuthModal } = useAuth();

  const handleLogin = () => {
    onClose();
    openAuthModal();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">You've reached your free limit 🎓</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Keep learning by unlocking more problems!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {!isAuthenticated && (
            <Button
              onClick={handleLogin}
              className="w-full gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              size="lg"
            >
              <Sparkles className="h-5 w-5" />
              Sign In for +2 Bonus Problems
            </Button>
          )}

          <Button
            onClick={onUpgrade}
            variant="outline"
            className="w-full gap-2"
            size="lg"
          >
            <Zap className="h-5 w-5" />
            Go Premium - Unlimited Access
          </Button>

          <p className="text-xs text-center text-muted-foreground pt-2">
            Premium: $10/month • Unlimited problems • Priority support
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
