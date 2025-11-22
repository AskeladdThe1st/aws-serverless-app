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
    const init = async () => {
      try {
        setIsFetchingChats(true);
        const userId = getOrCreateUserId();
        const sessions = await listChats(userId);

        const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
        const formattedSessions: ChatSession[] = rawSessions.map(s => ({
          id: s.session_id,
          title: s.title,
          messages: s.messages || [],
          createdAt: s.created_at
        }));
        setChatSessions(formattedSessions);

        const savedSessionId = localStorage.getItem('cgpt_session_id');
        if (savedSessionId) {
          setActiveChatId(savedSessionId);
          const chatData = await loadChat(savedSessionId, userId);
          setChatSessions(prev => prev.map(c =>
            c.id === savedSessionId
              ? { ...c, messages: chatData.messages || [] }
              : c
          ));
        } else {
          await createNewChat();
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

    init();
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

      localStorage.setItem('cgpt_session_id', sessionId);
      setActiveChatId(sessionId);

      // Reload sidebar from backend
      const sessions = await listChats(userId);
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      const formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [],
        createdAt: s.created_at
      }));
      setChatSessions(formattedSessions);

      // Load messages for the new chat from backend (source of truth)
      const chatData = await loadChat(sessionId, userId);
      setChatSessions(prev => prev.map(c =>
        c.id === sessionId
          ? { ...c, messages: chatData.messages || [] }
          : c
      ));

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
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      const formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [],
        createdAt: s.created_at
      }));
      
      setChatSessions(formattedSessions);
      
      if (chatId === activeChatId) {
        if (formattedSessions.length > 0) {
          const newActiveId = formattedSessions[0].id;
          setActiveChatId(newActiveId);
          localStorage.setItem('cgpt_session_id', newActiveId);
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
      localStorage.setItem('cgpt_session_id', chatId);
      
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

  const generateChatTitle = (text: string, hasImage: boolean): string => {
    if (!text.trim() && hasImage) {
      return 'Graph Analysis';
    }
    
    // Take first few words (3-6 words max)
    const words = text.trim().split(/\s+/);
    const titleWords = words.slice(0, 6);
    let title = titleWords.join(' ');
    
    // Truncate if too long
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }
    
    return title || 'New Chat';
  };

  const handleSend = async (text: string, image?: File) => {
    if ((!text.trim() && !image) || isLoading) return;

    const userId = getOrCreateUserId();
    const sessionId = localStorage.getItem('cgpt_session_id') || activeChatId;
    if (!userId || !sessionId) return;

    // Optimistically show user message immediately
    const userMessage: Message = {
      role: 'user',
      content: text || 'Analyzing image...',
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };
    setChatSessions(prev =>
      prev.map(chat =>
        chat.id === sessionId
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat
      )
    );

    setIsLoading(true);

    try {
      let imageBase64: string | undefined;
      if (image) {
        imageBase64 = await fileToBase64(image);
      }

      await solveProblem(userId, sessionId, text, imageBase64);

      // Auto-name chat if this is the first message
      const currentChat = chatSessions.find(c => c.id === sessionId);
      if (currentChat && (currentChat.title === 'New Chat' || !currentChat.title)) {
        const autoTitle = generateChatTitle(text, !!image);
        await updateChatTitle(sessionId, userId, autoTitle);
      }

      // Reload messages from DynamoDB after backend updates
      const chatData = await loadChat(sessionId, userId);
      
      // Also refresh sidebar to show updated title
      const sessions = await listChats(userId);
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      const formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [],
        createdAt: s.created_at
      }));
      
      setChatSessions(formattedSessions.map(chat =>
        chat.id === sessionId
          ? { ...chat, messages: chatData.messages || chat.messages }
          : chat
      ));
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
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          <div className="max-w-3xl mx-auto">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-3">
                  <Calculator className="h-12 w-12 text-primary mx-auto opacity-50" />
                  <h2 className="text-xl font-semibold text-foreground">How can I help with calculus today?</h2>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Send a message or upload a graph image to get started.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <ChatMessage key={index} message={message} />
                ))}
                {isLoading && (
                  <div className="flex justify-start mb-4">
                    <div className="bg-card border border-border rounded-2xl px-5 py-3">
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
              </>
            )}
          </div>
        </div>

        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Index;
