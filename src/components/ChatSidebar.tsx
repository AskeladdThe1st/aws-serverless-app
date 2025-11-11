import { useState } from 'react';
import { MessageSquarePlus, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { ChatSession } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export const ChatSidebar = ({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: ChatSidebarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div
      className={cn(
        'h-full border-r border-border bg-[#1a1a1a] transition-all duration-300 flex flex-col',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        {!isCollapsed && (
          <h2 className="text-sm font-semibold text-foreground">Chat Sessions</h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="h-8 w-8"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Chat Button */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onNewChat}
              className="w-full gap-2 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              <MessageSquarePlus className="h-4 w-4" />
              {!isCollapsed && <span>New Chat</span>}
            </Button>
          </TooltipTrigger>
          {isCollapsed && <TooltipContent side="right">New Chat</TooltipContent>}
        </Tooltip>
      </div>

      {/* Sessions List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={cn(
                'group relative rounded-lg transition-colors cursor-pointer',
                currentSessionId === session.id
                  ? 'bg-[#2f2f2f]'
                  : 'hover:bg-[#2f2f2f]/50'
              )}
            >
              <button
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left p-3"
              >
                {isCollapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center">
                        <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="max-w-xs">{session.title}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {truncateText(session.title)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.created_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </button>
              
              {!isCollapsed && onDeleteSession && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          
          {sessions.length === 0 && !isCollapsed && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No chat sessions yet.
              <br />
              Start a new chat!
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
