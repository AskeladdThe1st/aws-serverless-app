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
  onRenameChat: (id: string, newTitle: string) => void;
}

export const ChatSidebar = ({ chats, activeChat, onNewChat, onSelectChat, onDeleteChat, onRenameChat }: ChatSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDeleteChat(chatId);
  };

  const startEditing = (e: React.MouseEvent, chatId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingChatId(chatId);
    setEditingTitle(currentTitle);
  };

  const saveEdit = (chatId: string) => {
    if (editingTitle.trim() && editingTitle !== chats.find(c => c.id === chatId)?.title) {
      onRenameChat(chatId, editingTitle.trim());
    }
    setEditingChatId(null);
    setEditingTitle('');
  };

  const cancelEdit = () => {
    setEditingChatId(null);
    setEditingTitle('');
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
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
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
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                          if (editingChatId !== chat.id) {
                            onSelectChat(chat.id);
                            setIsOpen(false);
                          }
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
                            {editingChatId === chat.id ? (
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onBlur={() => saveEdit(chat.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    saveEdit(chat.id);
                                  } else if (e.key === 'Escape') {
                                    cancelEdit();
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                className="flex-1 text-sm bg-sidebar-bg border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <span
                                onClick={(e) => startEditing(e, chat.id, chat.title)}
                                className="flex-1 text-sm text-foreground truncate overflow-hidden whitespace-nowrap hover:text-primary transition-colors"
                              >
                                {chat.title}
                              </span>
                            )}
                            
                            {/* Delete Icon - Always rendered, visible on hover */}
                            {editingChatId !== chat.id && (
                              <button
                                onClick={(e) => handleDeleteClick(e, chat.id)}
                                className="flex-shrink-0 p-1 hover:bg-destructive/20 rounded transition-all opacity-0 group-hover:opacity-100"
                                aria-label="Delete chat"
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors" />
                              </button>
                            )}
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
