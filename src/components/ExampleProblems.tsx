import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Lightbulb } from 'lucide-react';

interface ExampleProblemsProps {
  onSelectExample: (problem: string) => void;
}

const examples = {
  Limits: [
    'Find the limit: lim(x→0) (sin(x)/x)',
    'Evaluate: lim(x→∞) (3x² + 2x)/(x² - 1)',
    'Find: lim(x→2) (x² - 4)/(x - 2)',
  ],
  Derivatives: [
    'Find the derivative of f(x) = x³ + 2x² - 5x + 1',
    'Differentiate: f(x) = sin(x) · cos(x)',
    'Find dy/dx if y = ln(x² + 1)',
  ],
  Integrals: [
    'Evaluate: ∫(3x² + 2x - 1)dx',
    'Find: ∫sin(2x)dx',
    'Calculate: ∫₀¹ x·e^x dx',
  ],
  'Series & Sequences': [
    'Find the sum of the series: Σ(n=1 to ∞) 1/n²',
    'Test for convergence: Σ(n=1 to ∞) 1/n!',
    'Find the Taylor series of f(x) = e^x at x=0',
  ],
};

export const ExampleProblems = ({ onSelectExample }: ExampleProblemsProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          <span className="hidden sm:inline">Examples</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto bg-popover">
        {Object.entries(examples).map(([category, problems]) => (
          <div key={category}>
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
              {category}
            </DropdownMenuLabel>
            {problems.map((problem, idx) => (
              <DropdownMenuItem
                key={`${category}-${idx}`}
                onClick={() => onSelectExample(problem)}
                className="cursor-pointer text-sm py-2 px-3"
              >
                {problem}
              </DropdownMenuItem>
            ))}
            {category !== 'Series & Sequences' && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
