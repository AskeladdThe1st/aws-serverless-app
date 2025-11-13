import { useState, useEffect, useRef } from 'react';
import { ChatMessage, Message } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { useToast } from '@/hooks/use-toast';
import { solveProblem, fileToBase64 } from '@/lib/lambda';
import { Calculator } from 'lucide-react';

const Index = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your calculus assistant. I can help you solve calculus problems. You can type a problem, paste it, or upload/capture an image of it!',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  const handleSend = async (text: string, image?: File) => {
    if ((!text.trim() && !image) || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text || 'Solve this problem',
      imageUrl: image ? URL.createObjectURL(image) : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
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

      setMessages((prev) => [...prev, assistantMessage]);
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
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#212121]">
      {/* Header */}
      <header className="border-b border-[#2f2f2f] bg-[#212121] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 flex-shrink-0">
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
  );
};

export default Index;
