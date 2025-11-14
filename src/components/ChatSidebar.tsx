import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Trash2, MessageSquare, Menu, X } from 'lucide-react';
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
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    onDeleteChat(chatId);
  };

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 lg:hidden bg-[#2f2f2f] hover:bg-[#3a3a3a] text-white"
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
          "fixed lg:static top-0 left-0 h-screen bg-[#1E1E1E] border-r border-[#2f2f2f] flex flex-col transition-transform duration-300 z-40",
          "w-64 flex-shrink-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* New Chat Button */}
        <div className="p-4 border-b border-[#2f2f2f]">
          <Button
            onClick={() => {
              onNewChat();
              setIsOpen(false);
            }}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-hidden">
          <div className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Chat History
          </div>
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="px-2 pb-4">
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
                          "group relative flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-all",
                          "hover:bg-[#2B2B2B]",
                          activeChat === chat.id ? "bg-[#2B2B2B]" : "bg-transparent"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <span className="flex-1 text-sm text-gray-200 truncate">
                          {chat.title}
                        </span>
                        
                        {/* Delete Icon - Shows on hover */}
                        {hoveredChat === chat.id && (
                          <button
                            onClick={(e) => handleDeleteClick(e, chat.id)}
                            className="flex-shrink-0 p-1 hover:bg-red-600/20 rounded transition-colors"
                            aria-label="Delete chat"
                          >
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-400 transition-colors" />
                          </button>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{chat.title}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                
                {chats.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-gray-500">
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
