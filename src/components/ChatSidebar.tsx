import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, MessageSquare, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
}

export const ChatSidebar = ({ chats, activeChat, onNewChat, onSelectChat, onDeleteChat, onOpenPricing }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

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
          isCollapsed ? "w-16" : "w-[280px]",
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

        {/* Chat History */}
        <div className="flex-1 overflow-hidden">
          {!isCollapsed && (
            <div className="px-4 py-3 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
              Chat History
            </div>
          )}
          <ScrollArea className={cn("h-[calc(100vh-200px)]", isCollapsed && "h-[calc(100vh-240px)]")}>
            <div className={cn("pb-4", isCollapsed ? "px-1" : "px-2")}>
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
                          "group relative flex items-center gap-2 mb-1 rounded-lg cursor-pointer transition-all",
                          "hover:bg-sidebar-hover",
                          activeChat === chat.id ? "bg-sidebar-hover" : "bg-transparent",
                          isCollapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2"
                        )}
                      >
                        <MessageSquare className={cn("h-4 w-4 text-muted-foreground flex-shrink-0", isCollapsed && "h-5 w-5")} />
                        
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-sm text-foreground truncate min-w-0">
                              {chat.title}
                            </span>
                            
                            {/* Delete Icon - visible on hover */}
                            <button
                              onClick={(e) => handleDeleteClick(e, chat.id)}
                              className="flex-shrink-0 p-1 hover:opacity-70 rounded transition-opacity opacity-0 group-hover:opacity-100"
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
              </TooltipProvider>
            </div>
          </ScrollArea>
        </div>

        {/* Usage Card */}
        <UsageCard
          problemsLeft={9}
          maxProblems={20}
          onSeePlans={onOpenPricing}
          onUpgrade={onOpenPricing}
          isCollapsed={isCollapsed}
        />

        {/* User Avatar at Bottom */}
        <div className={cn(
          "p-4 border-t border-sidebar-border",
          isCollapsed && "flex justify-center"
        )}>
          <UserAvatar isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
};
