import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { ChatSidebar, Chat } from '@/components/ChatSidebar';
import { useToast } from '@/hooks/use-toast';
import { solveProblem, fileToBase64 } from '@/lib/lambda';
import { Calculator } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const STORAGE_KEY = 'calculus-agent-chats';

const Index = () => {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
    // Initialize with default chat
    const defaultChat: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [
        {
          role: 'assistant',
          content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems. You can type a problem, paste it, or upload/capture an image of it!',
        },
      ],
      createdAt: Date.now(),
    };
    return [defaultChat];
  });

  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const sessions = JSON.parse(stored);
        return sessions[0]?.id || Date.now().toString();
      } catch {
        return Date.now().toString();
      }
    }
    return chatSessions[0]?.id || Date.now().toString();
  });

  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const activeChat = chatSessions.find(chat => chat.id === activeChatId);
  const messages = activeChat?.messages || [];

  // Save to localStorage whenever chats change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatSessions));
  }, [chatSessions]);

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

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [
        {
          role: 'assistant',
          content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems. You can type a problem, paste it, or upload/capture an image of it!',
        },
      ],
      createdAt: Date.now(),
    };
    setChatSessions(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (chatId: string) => {
    setChatSessions(prev => {
      const filtered = prev.filter(chat => chat.id !== chatId);
      // If deleting active chat, switch to another
      if (chatId === activeChatId && filtered.length > 0) {
        setActiveChatId(filtered[0].id);
      }
      // If no chats left, create a new one
      if (filtered.length === 0) {
        const newChat: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [
            {
              role: 'assistant',
              content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems. You can type a problem, paste it, or upload/capture an image of it!',
            },
          ],
          createdAt: Date.now(),
        };
        setActiveChatId(newChat.id);
        return [newChat];
      }
      return filtered;
    });
  };

  const updateChatTitle = (chatId: string, firstUserMessage: string) => {
    setChatSessions(prev =>
      prev.map(chat =>
        chat.id === chatId && chat.title === 'New Chat'
          ? { ...chat, title: firstUserMessage.slice(0, 50) + (firstUserMessage.length > 50 ? '...' : '') }
          : chat
      )
    );
  };

  const handleSend = async (text: string, image?: File) => {
    if ((!text.trim() && !image) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text || 'Solve this problem',
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };

    // Update messages in the active chat
    setChatSessions(prev =>
      prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat
      )
    );

    // Update chat title if it's the first user message
    const currentChat = chatSessions.find(c => c.id === activeChatId);
    if (currentChat && currentChat.messages.length === 1) {
      updateChatTitle(activeChatId, text || 'Solve this problem');
    }

    setIsLoading(true);

    try {
      let imageBase64: string | undefined;
      if (image) {
        imageBase64 = await fileToBase64(image);
      }

      const response = await solveProblem(text, imageBase64);

      const assistantMessage: Message = {
        role: 'assistant',
        content: 'Here\'s the solution:',
        expression: response.expression,
        result: response.result,
        steps: response.steps,
      };

      setChatSessions(prev =>
        prev.map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        )
      );
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Error',
        description: 'Failed to solve the problem. Please check the console for details.',
        variant: 'destructive',
      });

      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. This might be due to a CORS issue or the Lambda function not responding correctly.',
      };
      setChatSessions(prev =>
        prev.map(chat =>
          chat.id === activeChatId
            ? { ...chat, messages: [...chat.messages, errorMessage] }
            : chat
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const chatList: Chat[] = chatSessions.map(chat => ({
    id: chat.id,
    title: chat.title,
    createdAt: chat.createdAt,
  }));

  return (
    <div className="flex h-screen bg-[#212121] overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar
        chats={chatList}
        activeChat={activeChatId}
        onNewChat={createNewChat}
        onSelectChat={setActiveChatId}
        onDeleteChat={deleteChat}
      />

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden">
        {/* Header */}
        <header className="border-b border-[#2f2f2f] bg-[#212121] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 flex-shrink-0 ml-12 lg:ml-0">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <Calculator className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Calculus Agent</h1>
          <p className="text-xs text-[#8e8e8e]">Powered by GPT-4 Vision + SymPy</p>
        </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-[#212121]">
        <div ref={messagesContainerRef} className="max-w-3xl mx-auto w-full">
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} message={msg} />
          ))}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="bg-[#2f2f2f] rounded-2xl px-6 py-4 animate-pulse">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-[#8e8e8e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Index;
