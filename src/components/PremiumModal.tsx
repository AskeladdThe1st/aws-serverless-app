import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown } from 'lucide-react';

interface PremiumModalProps {
  open: boolean;
  onClose: () => void;
}

export const PremiumModal = ({ open, onClose }: PremiumModalProps) => {
  const handleUpgrade = () => {
    // Placeholder for Stripe integration
    console.log('Upgrade to Premium clicked');
    // TODO: Integrate Stripe checkout
  };

  const benefits = [
    'Unlimited problem solving',
    'Saved chat history across devices',
    'Priority AI processing',
    'Advanced step-by-step explanations',
    'Export solutions to PDF',
    'Email support',
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-glow">
              <Crown className="h-10 w-10 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Upgrade to Premium</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Unlock unlimited access and advanced features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
                <span className="text-sm text-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-3xl font-bold text-foreground mb-1">$10</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>

          <Button
            onClick={handleUpgrade}
            className="w-full gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            size="lg"
          >
            <Zap className="h-5 w-5" />
            Upgrade with Stripe
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancel anytime • Secure payment via Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
