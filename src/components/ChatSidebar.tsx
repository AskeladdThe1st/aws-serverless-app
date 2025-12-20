import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Plus,
  Trash2,
  MessageSquare,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Upload,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';
import { UsageCard } from './UsageCard';

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
}

interface ChatSidebarProps {
  chats: Chat[];
  activeChat: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onOpenPricing: () => void;
  usage?: {
    problems_left?: number;
    limit?: number | null;
    subscription_status?: string;
    upgrade_required?: boolean;
  };
}

export const ChatSidebar = ({ chats, activeChat, onNewChat, onSelectChat, onDeleteChat, onOpenPricing, usage }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const maxProblems = usage?.limit === null ? undefined : usage?.limit || 20;
  const problemsLeft = usage?.limit === null ? maxProblems : usage?.problems_left ?? maxProblems ?? 0;
  const isUnlimited = usage?.limit === null;

  const workspaceEntries = [
    {
      id: 'workspace',
      label: 'Workspace',
      description: 'Keep all of your problem sessions together.',
      icon: FolderKanban,
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'Find diagrams and files you recently added.',
      icon: Upload,
    },
    {
      id: 'saved',
      label: 'Saved items',
      description: 'Quick access to pinned problems and notes.',
      icon: Star,
    },
  ];

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDeleteChat(chatId);
  };

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden bg-muted hover:opacity-70 text-foreground transition-opacity"
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static top-0 left-0 h-screen bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-all duration-300 z-40 flex-shrink-0",
          isCollapsed ? "w-16" : "w-[300px]",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header with Toggle */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between gap-2">
          {!isCollapsed ? (
            <>
              <Button
                onClick={() => {
                  onNewChat();
                  setIsOpen(false);
                }}
                className="flex-1 bg-primary hover:opacity-90 text-primary-foreground font-medium transition-opacity"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="hidden lg:flex text-muted-foreground hover:opacity-70 flex-shrink-0 transition-opacity"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <TooltipProvider>
              <div className="flex flex-col gap-2 w-full items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={() => {
                        onNewChat();
                        setIsOpen(false);
                      }}
                      size="icon"
                      className="bg-primary hover:opacity-90 text-primary-foreground transition-opacity"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>New Chat</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleCollapse}
                      className="text-muted-foreground hover:opacity-70 transition-opacity"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Expand Sidebar</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* Navigation and chats */}
        <ScrollArea className="flex-1">
          <div className={cn("space-y-6 py-4", isCollapsed ? "px-2" : "px-4")}> 
            <TooltipProvider>
              <div className="space-y-2">
                {!isCollapsed && (
                  <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Workspace</div>
                )}
                <div className="space-y-1">
                  {workspaceEntries.map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <Tooltip key={entry.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "group w-full rounded-lg transition-all text-left",
                              "hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                              isCollapsed ? "px-2 py-2.5 flex justify-center" : "px-3 py-2 flex items-center gap-3"
                            )}
                          >
                            <Icon className={cn("h-4 w-4 text-muted-foreground flex-shrink-0", isCollapsed && "h-5 w-5")}
                            />
                            {!isCollapsed && (
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{entry.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="text-sm font-medium">{entry.label}</div>
                          <p className="text-xs text-muted-foreground">{entry.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {!isCollapsed && (
                  <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Chat History</div>
                )}
                <div className="space-y-1">
                  {chats.map((chat) => (
                    <Tooltip key={chat.id} delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => {
                            onSelectChat(chat.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            "group relative flex items-center gap-2 rounded-lg cursor-pointer transition-all border border-transparent",
                            "hover:bg-sidebar-hover hover:border-sidebar-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            activeChat === chat.id ? "bg-sidebar-hover border-sidebar-border" : "bg-transparent",
                            isCollapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2"
                          )}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onSelectChat(chat.id);
                              setIsOpen(false);
                            }
                          }}
                        >
                          <MessageSquare className={cn("h-4 w-4 text-muted-foreground flex-shrink-0", isCollapsed && "h-5 w-5")} />

                          {!isCollapsed && (
                            <>
                              {/* Ensure long titles truncate with ellipsis and never push the delete icon off-screen */}
                              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground group-hover:text-foreground">
                                {chat.title}
                              </span>

                              <button
                                onClick={(e) => handleDeleteClick(e, chat.id)}
                                /* Fixed-width, non-shrinking slot so the icon never slides off screen; fades in on hover */
                                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 hover:bg-muted"
                                aria-label="Delete chat"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            </>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="text-xs break-words">{chat.title}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}

                  {chats.length === 0 && !isCollapsed && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No chat history yet.<br />Start a new chat!
                    </div>
                  )}
                </div>
              </div>
            </TooltipProvider>
          </div>
        </ScrollArea>

        <div className="border-t border-sidebar-border bg-sidebar-bg/80">
          <UsageCard
            problemsLeft={problemsLeft}
            maxProblems={maxProblems}
            isUnlimited={isUnlimited}
            statusLabel={usage?.subscription_status}
            onSeePlans={onOpenPricing}
            onUpgrade={onOpenPricing}
            isCollapsed={isCollapsed}
          />

          <div
            className={cn(
              "p-4 border-t border-sidebar-border",
              isCollapsed ? "flex justify-center" : "space-y-3"
            )}
          >
            <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
              <UserAvatar isCollapsed={isCollapsed} />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {usage?.subscription_status ? `${usage.subscription_status} plan` : 'Free plan'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">Manage your profile and plan.</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={onOpenPricing}
              >
                Upgrade plan
              </Button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
