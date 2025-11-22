import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar, Chat } from '@/components/ChatSidebar';
import { useToast } from '@/hooks/use-toast';
import { solveProblem, analyzeGraph, fileToBase64, createChat, listChats, loadChat, deleteChat as deleteSessionChat, getOrCreateUserId } from '@/lib/lambda';
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
  const activeRequestRef = useRef<{ sessionId: string; requestId: string } | null>(null);

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
      
      // Clear any active request tracking when switching chats
      activeRequestRef.current = null;
      setIsLoading(false);
      
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
    if (hasImage) {
      return 'Graph Analysis';
    }
    
    if (!text.trim()) {
      return 'New Chat';
    }
    
    // Take first 6-10 words
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const titleWords = words.slice(0, Math.min(10, words.length));
    let title = titleWords.join(' ');
    
    // Capitalize first letter
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title || 'New Chat';
  };

  const handleSend = async (text: string, image?: File) => {
    if ((!text.trim() && !image) || isLoading) return;

    const userId = getOrCreateUserId();
    const sessionId = localStorage.getItem('cgpt_session_id') || activeChatId;
    if (!userId || !sessionId) return;

    // Generate unique request ID for tracking
    const requestId = crypto.randomUUID();
    activeRequestRef.current = { sessionId, requestId };

    // Store original text for title generation later
    const originalText = text;
    const hasImage = !!image;

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
      // Route to correct backend action
      if (image) {
        // ANY image upload -> use graph action only
        const imageBase64 = await fileToBase64(image);
        // Pass text if available, otherwise undefined (not empty string)
        await analyzeGraph(userId, sessionId, imageBase64, text.trim() || undefined);
      } else {
        // Text only -> use solve action only
        await solveProblem(userId, sessionId, text);
      }

      // CRITICAL: Check if still on the same chat after backend call
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Response ignored - user switched chats');
        return;
      }

      // Reload messages from DynamoDB after backend updates
      const chatData = await loadChat(sessionId, userId);
      
      // CRITICAL: Check again after loadChat
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Messages ignored - user switched chats');
        return;
      }

      // Auto-name chat AFTER assistant reply (only if title is still "New Chat")
      console.log('[AUTO-TITLE] Loaded chat data:', { 
        sessionId, 
        currentTitle: chatData.title,
        hasMessages: !!chatData.messages?.length 
      });
      
      let shouldUpdateTitle = false;
      let autoTitle = '';
      
      // Check loaded chat data and local state for "New Chat" title
      const localChat = chatSessions.find((c) => c.id === sessionId);
      const isNewChatTitle =
        chatData.title === 'New Chat' ||
        localChat?.title === 'New Chat' ||
        !chatData.title;
      
      if (isNewChatTitle) {
        shouldUpdateTitle = true;
        
        // Determine text to use for title generation
        let titleText = originalText;
        
        // If no text was provided, find first user message in loaded data
        if (!titleText || !titleText.trim()) {
          const firstUserMsg = chatData.messages?.find((m: Message) => m.role === 'user' && m.content?.trim());
          titleText = firstUserMsg?.content || '';
        }
        
        console.log('[AUTO-TITLE] Will generate title from:', { 
          titleText: titleText?.substring(0, 50), 
          hasImage 
        });
        
        // Generate title
        if (hasImage && (!titleText || !titleText.trim())) {
          autoTitle = 'Graph Analysis';
        } else {
          autoTitle = generateChatTitle(titleText, hasImage);
        }
        
        console.log('[AUTO-TITLE] Generated title:', autoTitle);
      }

      // We no longer call any backend update action; title is managed in frontend state only
      // (see formattedSessions mapping below).

      // Refresh sidebar to show updated title and all sessions
      console.log('[AUTO-TITLE] Fetching fresh chat list...');
      const sessions = await listChats(userId);
      const rawSessions = Array.isArray(sessions) ? sessions : sessions.sessions || [];
      let formattedSessions: ChatSession[] = rawSessions.map(s => ({
        id: s.session_id,
        title: s.title,
        messages: s.messages || [],
        createdAt: s.created_at
      }));
      
      console.log('[AUTO-TITLE] Fresh sessions from backend:', 
        formattedSessions.map(s => ({ id: s.id, title: s.title }))
      );
      
      // If backend list has not yet propagated the new title, force it locally
      if (shouldUpdateTitle && autoTitle && autoTitle !== 'New Chat') {
        formattedSessions = formattedSessions.map(chat =>
          chat.id === sessionId ? { ...chat, title: autoTitle } : chat
        );
      }
      
      // CRITICAL: Final check before updating state
      if (activeRequestRef.current?.sessionId !== sessionId || 
          activeRequestRef.current?.requestId !== requestId) {
        console.log('Final state update ignored - user switched chats');
        return;
      }
 
       // Update chat sessions with fresh data from backend
       // Use formattedSessions directly - they already have the updated title from listChats
       setChatSessions(formattedSessions.map(chat =>
         chat.id === sessionId
           ? { ...chat, messages: chatData.messages || [] }
           : chat
       ));
       
       console.log('[AUTO-TITLE] State updated with new title');
    } catch (error) {
      console.error('Error processing request:', error);
      
      // Only show error if still on the same chat
      if (activeRequestRef.current?.sessionId === sessionId && 
          activeRequestRef.current?.requestId === requestId) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to process your request. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      // Only clear loading if still on the same chat
      if (activeRequestRef.current?.sessionId === sessionId && 
          activeRequestRef.current?.requestId === requestId) {
        setIsLoading(false);
      }
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
