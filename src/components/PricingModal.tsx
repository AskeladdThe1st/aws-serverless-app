import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlan: (planId: string, priceId?: string) => void;
  isProcessing?: boolean;
  processingPlanId?: string | null;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'month',
    priceId: undefined,
    features: [
      '15 problems/day after signing in',
      'Access to GPT-4o family models',
      'Saved chat history',
    ],
    recommended: false,
  },
  {
    id: 'student-plus',
    name: 'Student Plus',
    price: '$15',
    period: 'month',
    priceId: undefined,
    features: [
      'Higher daily limits for frequent practice',
      'Access to GPT-4.1 and image uploads',
      'Saved history & bookmarks',
    ],
    recommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$40',
    period: 'month',
    priceId: undefined,
    features: [
      'Unlimited usage',
      'Full GPT-5 access',
      'Priority responses',
      'Best for power users / tutors',
    ],
    recommended: false,
  },
];

export const PricingModal = ({
  open,
  onOpenChange,
  onSelectPlan,
  isProcessing = false,
  processingPlanId = null,
}: PricingModalProps) => {
  const handlePlanSelect = (planId: string, priceId?: string) => {
    onSelectPlan(planId, priceId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Choose Your Plan</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-lg border-2 p-6 space-y-6 transition-all ${
                plan.recommended
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                  Recommended
                </Badge>
              )}

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/ {plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.id === 'free' ? (
                <div className="w-full rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 px-4 py-3 text-center text-sm text-muted-foreground">
                  Included with your free account
                </div>
              ) : (
                <Button
                  onClick={() => handlePlanSelect(plan.id, plan.priceId)}
                  variant={plan.recommended ? 'default' : 'outline'}
                  className="w-full"
                  disabled={isProcessing && processingPlanId === plan.id}
                >
                  {isProcessing && processingPlanId === plan.id ? 'Starting checkout...' : 'Choose plan'}
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
