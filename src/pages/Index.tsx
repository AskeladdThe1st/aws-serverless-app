import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar, Chat } from '@/components/ChatSidebar';
import { SettingsPanel } from '@/components/SettingsPanel';
import { useToast } from '@/hooks/use-toast';
import { solveProblem, analyzeGraph, fileToBase64, createChat, listChats, loadChat, deleteChat as deleteSessionChat, getOrCreateUserId, updateChatTitle } from '@/lib/lambda';
import { Calculator, Settings } from 'lucide-react';

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
  const [isManualMode, setIsManualMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  // Keyboard shortcut: ESC to cancel loading
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        setIsLoading(false);
        activeRequestRef.current = null;
        toast({
          title: 'Request cancelled',
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, toast]);

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

  const handleSend = async (text: string, images?: File[]) => {
    if ((!text.trim() && !images?.length) || isLoading) return;

    const userId = getOrCreateUserId();
    const sessionId = localStorage.getItem('cgpt_session_id') || activeChatId;
    if (!userId || !sessionId) return;

    // Generate unique request ID for tracking
    const requestId = crypto.randomUUID();
    activeRequestRef.current = { sessionId, requestId };

    // Store original text for title generation later
    const originalText = text;
    const hasImage = !!images?.length;

    // Optimistically show user message immediately
    const userMessage: Message = {
      role: 'user',
      content: text || 'Analyzing images...',
      imageUrl: images?.[0] ? URL.createObjectURL(images[0]) : undefined,
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
      if (images && images.length > 0) {
        // Convert all images to base64
        const imagesBase64 = await Promise.all(images.map(img => fileToBase64(img)));
        
        // Check for derivative keywords in user text
        const derivativeKeywords = ['derivative', 'd/dx', 'dp/dq', 'dy/dx', 'differentiate'];
        const hasDerivativeKeyword = derivativeKeywords.some(keyword => 
          text.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // If derivative keywords present, always route to solve
        if (hasDerivativeKeyword) {
          await fetch('https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'solve',
              user_id: userId,
              session_id: sessionId,
              text: text || 'Solve this problem',
              images: imagesBase64,
            }),
          });
        } else {
          try {
            // Classify the first image
            const classifyResponse = await fetch('https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'solve',
                user_id: userId,
                session_id: sessionId,
                text: 'Classify this image: is it a graph or a math question? Answer with just "graph" or "not graph".',
                images: [imagesBase64[0]],
              }),
            }).then(res => res.json()).then(data => data?.body ? JSON.parse(data.body) : data);
            
            const classificationText = classifyResponse?.analysis || '';
            const isGraph = classificationText.toLowerCase().includes('graph') && 
                           !classificationText.toLowerCase().includes('not graph');
            
            if (isGraph) {
              // It's a graph -> send graph action with first image only
              const payload: any = {
                action: "graph",
                user_id: userId,
                session_id: sessionId,
                images: [imagesBase64[0]],
                manual_mode: isManualMode,
              };
              
              if (text.trim()) payload.text = text;
              
              await fetch('https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            } else {
              // Not a graph -> send solve action with all images
              await fetch('https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'solve',
                  user_id: userId,
                  session_id: sessionId,
                  text: text || 'Solve this problem',
                  images: imagesBase64,
                }),
              });
            }
          } catch (classifyError) {
            console.error('Classification error, falling back to solve:', classifyError);
            // Fallback to solve if classification fails
            await fetch('https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'solve',
                user_id: userId,
                session_id: sessionId,
                text: text || 'Solve this problem',
                images: imagesBase64,
              }),
            });
          }
        }
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

      // Persist auto-generated title to backend when needed
      if (shouldUpdateTitle && autoTitle && autoTitle !== 'New Chat') {
        await updateChatTitle(sessionId, userId, autoTitle);
      }

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
          
          {/* Settings icon in top-right */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-accent"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>
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

        <div className="border-t border-border px-4 py-4 bg-card">
          <div className="max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} disabled={isLoading} />
          </div>
        </div>
      </div>

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        manualMode={isManualMode}
        onManualModeChange={setIsManualMode}
      />
    </div>
  );
};

export default Index;
