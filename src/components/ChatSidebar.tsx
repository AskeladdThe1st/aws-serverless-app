import { useState } from 'react';
import { MessageSquarePlus, ChevronLeft, ChevronRight, Trash2, Pencil, Check, X } from 'lucide-react';
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const handleRenameStart = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleRenameSave = (sessionId: string) => {
    // TODO: Call API to update session title when backend is ready
    console.log('Rename session:', sessionId, 'to:', editTitle);
    setEditingId(null);
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div
      className={cn(
        'h-full border-r border-border bg-card transition-all duration-300 flex flex-col',
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
                  ? 'bg-secondary'
                  : 'hover:bg-secondary/50'
              )}
            >
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSelectSession(session.id)}
                      className="w-full p-3 flex items-center justify-center"
                    >
                      <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="max-w-xs">{session.title}</p>
                  </TooltipContent>
                </Tooltip>
              ) : editingId === session.id ? (
                <div className="p-2 space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-2 py-1 text-sm bg-background border border-border rounded"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSave(session.id);
                      if (e.key === 'Escape') handleRenameCancel();
                    }}
                  />
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRenameSave(session.id)}
                      className="h-6 w-6"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRenameCancel}
                      className="h-6 w-6"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full text-left p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {truncateText(session.title)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(session.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRenameStart(session);
                      }}
                      className="h-6 w-6"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {onDeleteSession && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </>
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
