import { ChevronDown, LineChart, FileQuestion, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ToolsMenuProps {
  onSelectTool: (text: string) => void;
}

const TOOLS = [
  { 
    id: 'graph', 
    name: 'Create Graph', 
    text: 'Graph the function: ',
    icon: LineChart,
    description: 'Visualize functions'
  },
  { 
    id: 'test', 
    name: 'Create Practice Test', 
    text: 'Create a practice test about ',
    icon: FileQuestion,
    description: 'Generate quiz questions'
  },
  { 
    id: 'guide', 
    name: 'Create Study Guide', 
    text: 'Create a study guide about ',
    icon: BookOpen,
    description: 'Comprehensive notes'
  },
];

export const ToolsMenu = ({ onSelectTool }: ToolsMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-3">
          <span className="text-sm">Tools</span>
          <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Prompt Starters
        </div>
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <DropdownMenuItem
              key={tool.id}
              onClick={() => onSelectTool(tool.text)}
              className="flex items-start gap-3 py-2.5 cursor-pointer"
            >
              <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="flex-1 space-y-0.5">
                <div className="text-sm font-medium">{tool.name}</div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
