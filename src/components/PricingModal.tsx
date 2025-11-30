import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'month',
    features: [
      'Up to 20 problems/day',
      'Access to standard models',
      'Basic step-by-step solutions',
    ],
    recommended: false,
  },
  {
    id: 'student-plus',
    name: 'Student Plus',
    price: '$15',
    period: 'month',
    features: [
      'Higher daily limits',
      'Access to advanced reasoning models',
      'Image uploads for homework',
      'Saved history & bookmarks',
    ],
    recommended: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$40',
    period: 'month',
    features: [
      'Highest limits and GPT-5 access',
      'Priority responses',
      'Best for power users / tutors',
    ],
    recommended: false,
  },
];

export const PricingModal = ({ open, onOpenChange }: PricingModalProps) => {
  const handlePlanSelect = (planId: string) => {
    console.log('Selected plan:', planId);
    onOpenChange(false);
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

              <Button
                onClick={() => handlePlanSelect(plan.id)}
                variant={plan.recommended ? 'default' : 'outline'}
                className="w-full"
              >
                Choose plan
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
