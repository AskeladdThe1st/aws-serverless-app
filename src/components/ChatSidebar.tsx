import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, MessageSquare, Menu, X, ChevronLeft, ChevronRight, Folder, FolderPlus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from './UserAvatar';
import { UsageCard } from './UsageCard';
import { WorkspaceItem } from '@/lib/workspaces';

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
  onCreateWorkspace: () => void;
  onSelectWorkspace: (id: string) => void;
  workspaces: WorkspaceItem[];
  usage?: {
    problems_left?: number;
    limit?: number | null;
    subscription_status?: string;
    upgrade_required?: boolean;
    plan?: string;
  };
  planLabel?: string;
}

export const ChatSidebar = ({
  chats,
  activeChat,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenPricing,
  onCreateWorkspace,
  onSelectWorkspace,
  workspaces,
  usage,
  planLabel
}: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const maxProblems = usage?.limit === null ? undefined : usage?.limit || 20;
  const problemsLeft = usage?.limit === null ? maxProblems : usage?.problems_left ?? maxProblems ?? 0;
  const isUnlimited = usage?.limit === null;
  const normalizedPlan = (planLabel || usage?.plan || '').toLowerCase();
  const isProPlan = normalizedPlan === 'pro' || (usage?.subscription_status || '').toLowerCase() === 'pro';
  const planDisplay = planLabel || usage?.plan || 'guest';

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

  const sectionHeading = (label: string) => (
    <div className={cn(
      'flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2',
      isCollapsed && 'justify-center'
    )}>
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );

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
          'fixed lg:static top-0 left-0 h-screen bg-sidebar-bg border-r border-sidebar-border flex flex-col transition-all duration-300 z-40 flex-shrink-0',
          isCollapsed ? 'w-16' : 'w-[300px]',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Header with brand and collapse */}
        <div className="p-4 border-b border-sidebar-border flex items-center justify-between gap-2">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">Math Tutor Agent</p>
                <p className="text-xs text-muted-foreground">AI workspace</p>
              </div>
            </div>
          ) : (
            <Sparkles className="h-5 w-5 text-primary" />
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="hidden lg:flex text-muted-foreground hover:opacity-70 flex-shrink-0 transition-opacity"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className={cn('p-3 space-y-6', isCollapsed && 'px-2')}>            
            {/* Workspaces */}
            <div>
              {sectionHeading('Workspaces')}
              <div className="space-y-2">
                {workspaces.length === 0 && !isCollapsed && (
                  <div className="text-sm text-muted-foreground px-3 py-2 rounded-lg bg-muted/30 border border-sidebar-border/60">
                    Workspace folders will appear here.
                  </div>
                )}
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => {
                      onSelectWorkspace(workspace.id);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'group w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors bg-transparent hover:bg-sidebar-hover',
                      isCollapsed && 'justify-center'
                    )}
                  >
                    <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{workspace.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">Workspace</p>
                      </div>
                    )}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size={isCollapsed ? 'icon' : 'sm'}
                  onClick={() => {
                    onCreateWorkspace();
                    setIsOpen(false);
                  }}
                  className={cn('w-full justify-center', isCollapsed && 'h-9 px-0')}
                >
                  <FolderPlus className="h-4 w-4" />
                  {!isCollapsed && <span className="ml-2 text-sm">Create Workspace</span>}
                </Button>
              </div>
            </div>

            {/* Chat History */}
            <div>
              <div className="flex items-center justify-between mb-2">
                {sectionHeading('Chat History')}
                {!isCollapsed && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onNewChat();
                      setIsOpen(false);
                    }}
                    className="h-8 px-3 text-xs font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Chat
                  </Button>
                )}
              </div>
              <div className={cn('space-y-1', isCollapsed && 'space-y-1.5')}
              >
                <TooltipProvider>
                  {chats.map((chat) => (
                    <Tooltip key={chat.id}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => {
                            onSelectChat(chat.id);
                            setIsOpen(false);
                          }}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-lg cursor-pointer transition-colors',
                            'hover:bg-sidebar-hover',
                            activeChat === chat.id ? 'bg-sidebar-hover' : 'bg-transparent',
                            isCollapsed ? 'px-2.5 py-2 justify-center' : 'px-3 py-2'
                          )}
                        >
                          <MessageSquare className={cn('h-4 w-4 text-muted-foreground flex-shrink-0', isCollapsed && 'h-5 w-5')} />

                          {!isCollapsed && (
                            <>
                              <span className="flex-1 text-sm text-foreground truncate min-w-0">
                                {chat.title}
                              </span>
                              <button
                                onClick={(e) => handleDeleteClick(e, chat.id)}
                                className="flex-shrink-0 p-1 rounded hover:bg-muted/60 transition-colors"
                                aria-label="Delete chat"
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
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
                </TooltipProvider>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Account */}
        <div className="border-t border-sidebar-border p-4 space-y-3">
          {!isCollapsed && (
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Account</p>
                <p className="text-sm font-medium text-foreground capitalize">{planDisplay}</p>
              </div>
            </div>
          )}

          <UsageCard
            problemsLeft={problemsLeft}
            maxProblems={maxProblems}
            isUnlimited={isUnlimited}
            statusLabel={usage?.subscription_status}
            onSeePlans={onOpenPricing}
            onUpgrade={onOpenPricing}
            isCollapsed={isCollapsed}
            showUpgrade={!isProPlan}
            showSeePlans={false}
          />

          <div className={cn('border border-sidebar-border/60 rounded-lg px-3 py-2.5 flex items-center gap-3', isCollapsed && 'justify-center')}
          >
            <UserAvatar isCollapsed={isCollapsed} />
            {!isCollapsed && (
              <div className="text-sm text-muted-foreground">Stay within your workspace and history.</div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
