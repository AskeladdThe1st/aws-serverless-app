import { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ExampleProblems } from '@/components/ExampleProblems';
import { OptionalAuthHeader } from '@/components/OptionalAuthHeader';
import { FreemiumProgress } from '@/components/FreemiumProgress';
import { FreemiumModal } from '@/components/FreemiumModal';
import { PremiumModal } from '@/components/PremiumModal';
import { AuthModal } from '@/components/AuthModal';
import { Message, ChatSession } from '@/lib/types';
import { toast } from 'sonner';
import { solveProblem, fileToBase64, saveMessage } from '@/lib/lambda';
import { Calculator, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useAuth } from '@/contexts/AuthContext';
import { useFreemium } from '@/hooks/useFreemium';
import katex from 'katex';

const STORAGE_KEY = 'calculus-chat-messages';
const SESSION_KEY = 'current-session-id';

const Index = () => {
  const { user, isAuthenticated, showAuthModal, closeAuthModal } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [exampleText, setExampleText] = useState('');
  const [showFreemiumModal, setShowFreemiumModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Fetch sessions using React Query
  const { data: sessions = [] } = useChatSessions(user?.userId);
  
  // Freemium tracking
  const freemium = useFreemium(isAuthenticated);

  // Initialize session from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem(SESSION_KEY);
    if (savedSessionId) {
      setCurrentSessionId(savedSessionId);
    }
  }, []);

  // Load messages for current session
  useEffect(() => {
    if (currentSessionId) {
      const savedMessages = localStorage.getItem(`${STORAGE_KEY}-${currentSessionId}`);
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
    }
  }, [currentSessionId]);

  // Save messages to localStorage when they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      localStorage.setItem(`${STORAGE_KEY}-${currentSessionId}`, JSON.stringify(messages));
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;

      // Re-render all math expressions
      const mathElements = container.querySelectorAll('.katex');
      mathElements.forEach((element) => {
        const mathContent = element.textContent || '';
        if (mathContent) {
          try {
            katex.render(mathContent, element as HTMLElement, {
              throwOnError: false,
              displayMode: element.classList.contains('katex-display'),
            });
          } catch (e) {
            console.error('KaTeX rendering error:', e);
          }
        }
      });
    }
  }, [messages]);

  const generateSessionId = () => {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleNewChat = () => {
    const newSessionId = generateSessionId();
    setCurrentSessionId(newSessionId);
    setMessages([]);
    localStorage.setItem(SESSION_KEY, newSessionId);
    localStorage.removeItem(`${STORAGE_KEY}-${newSessionId}`);
    toast.success('New chat started ✅');
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    localStorage.setItem(SESSION_KEY, sessionId);
    const savedMessages = localStorage.getItem(`${STORAGE_KEY}-${sessionId}`);
    if (savedMessages) {
      setMessages(JSON.parse(savedMessages));
    } else {
      setMessages([]);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    if (currentSessionId) {
      localStorage.removeItem(`${STORAGE_KEY}-${currentSessionId}`);
    }
    toast.success('Chat cleared ✅');
  };

  const handleExampleSelect = (problem: string) => {
    setExampleText(problem);
  };

  const handleSend = async (text: string, image?: File) => {
    if (!text.trim() && !image) return;

    // Check freemium limit
    if (freemium.isLimitReached) {
      setShowFreemiumModal(true);
      return;
    }

    // Ensure we have a session ID
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
      localStorage.setItem(SESSION_KEY, sessionId);
    }

    const imageBase64 = image ? await fileToBase64(image) : undefined;
    const imageUrl = image ? URL.createObjectURL(image) : undefined;

    const userMessage: Message = {
      role: 'user',
      content: text,
      imageUrl,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Save user message
      if (user?.userId) {
        await saveMessage(sessionId, userMessage, user.userId);
      }

      // Call Lambda with session_id and user_id
      const response = await solveProblem(
        text,
        imageBase64,
        sessionId,
        user?.userId
      );

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.result,
        expression: response.expression,
        result: response.result,
        steps: response.steps,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      if (user?.userId) {
        await saveMessage(sessionId, assistantMessage, user.userId);
      }

      // Increment problem count
      freemium.incrementProblems();

      // Show upgrade hint at 5 problems for guests
      if (!isAuthenticated && freemium.problemsSolved === 5) {
        toast.info('✨ You have 2 free problems left — sign in for 2 bonus problems!', {
          duration: 5000,
        });
      }

      // Clear example text after sending
      setExampleText('');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to solve problem. Please try again.');

      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={handleSelectSession}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b border-border bg-background px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 flex-shrink-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">Calculus Assistant</h1>
            <p className="text-xs text-muted-foreground truncate">Solve calculus problems with step-by-step explanations</p>
          </div>
          <OptionalAuthHeader onUpgradeClick={() => setShowPremiumModal(true)} />
        </header>

        {/* Freemium Progress */}
        <FreemiumProgress
          problemsSolved={freemium.problemsSolved}
          limit={freemium.limit}
          remaining={freemium.remaining}
          progress={freemium.progress}
          isAuthenticated={isAuthenticated}
          onUpgradeClick={() => setShowPremiumModal(true)}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-background">
          <div ref={messagesContainerRef} className="max-w-3xl mx-auto w-full">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                  <Calculator className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">Welcome to Calculus Assistant</h2>
                <p className="text-muted-foreground mb-6">Ask me any calculus question or try an example below</p>
                <ExampleProblems onSelectExample={handleExampleSelect} />
              </div>
            )}

            {messages.map((msg, idx) => (
              <ChatMessage key={idx} message={msg} />
            ))}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="bg-card rounded-2xl px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="animate-bounce">●</div>
                    <div className="animate-bounce animation-delay-200">●</div>
                    <div className="animate-bounce animation-delay-400">●</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-background px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Utility Buttons */}
            <div className="flex items-center justify-between gap-2">
              <ExampleProblems onSelectExample={handleExampleSelect} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                disabled={messages.length === 0}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Clear Chat</span>
              </Button>
            </div>
            
            <ChatInput 
              onSend={handleSend} 
              disabled={isLoading}
              initialValue={exampleText}
              onClear={() => setExampleText('')}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <FreemiumModal
        open={showFreemiumModal}
        onClose={() => setShowFreemiumModal(false)}
        onUpgrade={() => {
          setShowFreemiumModal(false);
          setShowPremiumModal(true);
        }}
        isAuthenticated={isAuthenticated}
      />

      <PremiumModal
        open={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
      />

      <AuthModal
        open={showAuthModal}
        onClose={closeAuthModal}
      />
    </div>
  );
};

export default Index;
