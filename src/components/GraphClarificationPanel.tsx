import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ClarificationStep {
  stepNumber: number;
  question: string;
  answer?: string;
}

interface GraphClarificationPanelProps {
  isOpen: boolean;
  imagePreview?: string;
  steps: ClarificationStep[];
  isComplete: boolean;
  onClose: () => void;
}

export function GraphClarificationPanel({ 
  isOpen, 
  imagePreview, 
  steps, 
  isComplete,
  onClose 
}: GraphClarificationPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border z-50 animate-slide-in-right flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Graph Clarification</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Image Preview */}
            {imagePreview && (
              <div className="rounded-lg border border-border overflow-hidden bg-background">
                <img 
                  src={imagePreview} 
                  alt="Graph" 
                  className="w-full h-auto"
                />
              </div>
            )}

            {/* Clarification Steps */}
            {steps.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Clarification Steps
                  </h3>
                  
                  {steps.map((step) => (
                    <div 
                      key={step.stepNumber} 
                      className="bg-background/50 rounded-lg p-3 border border-border space-y-2"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                          {step.stepNumber}
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm text-foreground font-medium">
                            {step.question}
                          </p>
                          {step.answer && (
                            <p className="text-sm text-muted-foreground">
                              → {step.answer}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Completion indicator */}
            {isComplete && (
              <div className="bg-primary/10 text-primary rounded-lg p-3 border border-primary/20 text-center">
                <p className="text-sm font-medium">✓ Analysis Complete</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
}
