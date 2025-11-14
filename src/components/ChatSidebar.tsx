import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, MessageSquare, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

export const ChatSidebar = ({ chats, activeChat, onNewChat, onSelectChat, onDeleteChat }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

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
        className="fixed top-4 left-4 z-50 lg:hidden bg-muted hover:bg-muted/80 text-foreground"
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
          isCollapsed ? "w-16" : "w-64",
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
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Chat
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="hidden lg:flex text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
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
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
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
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
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
          <ScrollArea className={cn("h-[calc(100vh-140px)]", isCollapsed && "h-[calc(100vh-180px)]")}>
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
                        onMouseEnter={() => setHoveredChat(chat.id)}
                        onMouseLeave={() => setHoveredChat(null)}
                        className={cn(
                          "group relative flex items-center gap-2 mb-1 rounded-lg cursor-pointer transition-all",
                          "hover:bg-sidebar-hover",
                          activeChat === chat.id ? "bg-sidebar-hover" : "bg-transparent",
                          isCollapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2"
                        )}
                      >
                        <MessageSquare className={cn("h-4 w-4 text-muted-foreground/70 flex-shrink-0", isCollapsed && "h-5 w-5")} />
                        
                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-sm text-foreground/90 truncate min-w-0 overflow-hidden">
                              {chat.title}
                            </span>
                            
                            {/* Delete Icon - Shows on hover */}
                            <button
                              onClick={(e) => handleDeleteClick(e, chat.id)}
                              className={cn(
                                "flex-shrink-0 p-1.5 hover:bg-destructive/20 rounded transition-all ml-1",
                                hoveredChat === chat.id ? "opacity-100" : "opacity-0"
                              )}
                              aria-label="Delete chat"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-destructive transition-colors" />
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
      </aside>
    </>
  );
};
