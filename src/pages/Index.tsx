import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar, Chat } from '@/components/ChatSidebar';
import { useToast } from '@/hooks/use-toast';
import { solveProblem, fileToBase64, createChat, listChats, loadChat, deleteChat as deleteSessionChat, updateChatTitle, getOrCreateUserId } from '@/lib/lambda';
import { Calculator } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const Index = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingChats, setIsFetchingChats] = useState(true);
  const { toast } = useToast();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const activeChat = chatSessions.find(chat => chat.id === activeChatId);
  const messages = activeChat?.messages || [];

  // Load chats from backend on mount
  useEffect(() => {
    const loadChatsFromBackend = async () => {
      try {
        setIsFetchingChats(true);
        const userId = getOrCreateUserId();
        const sessions = await listChats(userId);
        
        if (sessions.length === 0) {
          await createNewChat();
        } else {
          const formattedSessions: ChatSession[] = sessions.map(s => ({
            id: s.session_id,
            title: s.title,
            messages: s.messages || [{
              role: 'assistant' as const,
              content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems.',
            }],
            createdAt: s.created_at
          }));
          setChatSessions(formattedSessions);
          
          // Restore last active chat from current_session or use first chat
          const savedSessionId = localStorage.getItem('current_session');
          const chatToActivate = savedSessionId && formattedSessions.find(s => s.id === savedSessionId)
            ? savedSessionId
            : formattedSessions[0].id;
          setActiveChatId(chatToActivate);
          localStorage.setItem('current_session', chatToActivate);
          
          // Load messages for the active chat
          if (chatToActivate) {
            const chatData = await loadChat(chatToActivate, userId);
            setChatSessions(prev => prev.map(c => 
              c.id === chatToActivate 
                ? { ...c, messages: chatData.messages || c.messages }
                : c
            ));
          }
        }
      } catch (error) {
        console.error('Error loading chats:', error);
        toast({
          title: 'Error loading chats',
          variant: 'destructive',
        });
        await createNewChat();
      } finally {
        setIsFetchingChats(false);
      }
    };

    loadChatsFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Force KaTeX to re-render after new messages
  useEffect(() => {
    if (messagesContainerRef.current && typeof window !== 'undefined') {
      const renderMathInElement = (window as any).renderMathInElement;
      if (renderMathInElement) {
        renderMathInElement(messagesContainerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\[', right: '\\]', display: true },
            { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false
        });
      }
    }
  }, [messages]);

  const createNewChat = async () => {
    try {
      const userId = getOrCreateUserId();
      const sessionId = crypto.randomUUID();
      
      await createChat(sessionId, userId, 'New Chat');
      
      localStorage.setItem('current_session', sessionId);
      setActiveChatId(sessionId);
      
      // Reload sidebar from backend
      const sessions = await listChats(userId);
      const formattedSessions: ChatSession[] = sessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [{
          role: 'assistant' as const,
          content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems.',
        }],
        createdAt: s.created_at
      }));
      setChatSessions(formattedSessions);
      
      toast({
        title: 'Chat created',
      });
    } catch (error) {
      console.error('Error creating chat:', error);
      toast({
        title: 'Error',
        variant: 'destructive',
      });
    }
  };

  const deleteChatSession = async (chatId: string) => {
    try {
      const userId = getOrCreateUserId();
      await deleteSessionChat(chatId, userId);
      
      // Reload chat history from backend
      const sessions = await listChats(userId);
      const formattedSessions: ChatSession[] = sessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [{
          role: 'assistant' as const,
          content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems.',
        }],
        createdAt: s.created_at
      }));
      
      setChatSessions(formattedSessions);
      
      if (chatId === activeChatId) {
        if (formattedSessions.length > 0) {
          const newActiveId = formattedSessions[0].id;
          setActiveChatId(newActiveId);
          localStorage.setItem('current_session', newActiveId);
        } else {
          await createNewChat();
        }
      }
      
      toast({
        title: 'Chat deleted',
      });
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast({
        title: 'Error',
        variant: 'destructive',
      });
    }
  };

  const selectChat = async (chatId: string) => {
    try {
      const userId = getOrCreateUserId();
      
      setActiveChatId(chatId);
      localStorage.setItem('current_session', chatId);
      
      // Always load from backend
      const chatData = await loadChat(chatId, userId);
      setChatSessions(prev => prev.map(c => 
        c.id === chatId 
          ? { ...c, messages: chatData.messages || c.messages }
          : c
      ));
    } catch (error) {
      console.error('Error loading chat:', error);
    }
  };

  const renameChatSession = async (chatId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    
    try {
      const userId = getOrCreateUserId();
      await updateChatTitle(chatId, userId, newTitle);
      
      // Reload from backend
      const sessions = await listChats(userId);
      const formattedSessions: ChatSession[] = sessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [{
          role: 'assistant' as const,
          content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems.',
        }],
        createdAt: s.created_at
      }));
      setChatSessions(formattedSessions);
      
      toast({
        title: 'Chat renamed',
      });
    } catch (error) {
      console.error('Error renaming chat:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename chat.',
        variant: 'destructive',
      });
    }
  };

  const handleSend = async (text: string, image?: File) => {
    if ((!text.trim() && !image) || isLoading) return;

    const userId = getOrCreateUserId();
    const sessionId = localStorage.getItem('current_session') || activeChatId;

    setIsLoading(true);

    try {
      let imageBase64: string | undefined;
      if (image) {
        imageBase64 = await fileToBase64(image);
      }

      await solveProblem(sessionId, userId, text, imageBase64);

      // Reload messages from DynamoDB after backend updates
      const chatData = await loadChat(sessionId, userId);
      setChatSessions(prev =>
        prev.map(chat =>
          chat.id === sessionId
            ? { ...chat, messages: chatData.messages || chat.messages }
            : chat
        )
      );
    } catch (error) {
      console.error('Error solving problem:', error);
      toast({
        title: 'Error',
        description: 'Failed to solve the problem. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const chatsForSidebar: Chat[] = chatSessions.map(chat => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
  }));

  if (isFetchingChats) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-screen bg-background overflow-hidden">
      <ChatSidebar
        chats={chatsForSidebar}
        activeChat={activeChatId}
        onNewChat={createNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChatSession}
        onRenameChat={renameChatSession}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <Calculator className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Calculus Agent</h1>
              <p className="text-sm text-muted-foreground">Your personal math solver</p>
            </div>
          </div>
        </header>

        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-2"
        >
          <div className="max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-card border border-border rounded-2xl px-6 py-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm text-muted-foreground">Solving...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Index;
