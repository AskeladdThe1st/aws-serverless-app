import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ResponseView from './ResponseView';
import { useToast } from '@/hooks/use-toast';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  expression?: string;
  result?: string;
  steps?: string;
  imageUrl?: string;
}

export const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    // Combine all solution parts
    const solutionText = [
      message.content,
      message.expression && `Expression: ${message.expression}`,
      message.result && `Result: ${message.result}`,
      message.steps && `Steps:\n${message.steps}`,
    ]
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard.writeText(solutionText);
    setCopied(true);
    toast({
      title: 'Copied!',
      description: 'Solution copied to clipboard',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div
        className={`relative group max-w-[85%] rounded-2xl px-5 py-3 break-words overflow-hidden ${
          isUser
            ? 'bg-secondary text-foreground'
            : 'bg-card text-foreground border border-border'
        }`}
      >
        {/* Copy Button - Only show for assistant messages with solutions */}
        {!isUser && (message.result || message.steps) && (
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 hover:bg-background opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Copy solution"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        )}
        
        {message.imageUrl && (
          <img 
            src={message.imageUrl} 
            alt="Uploaded" 
            className="max-w-full rounded-lg mb-2 border border-border"
          />
        )}
        
        <div className="break-words overflow-hidden">
          <ResponseView content={message.content} />
        </div>

        {!isUser && message.result && (
          <div className="mt-4 pt-3 border-t border-border/50 break-words">
            <div className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Result:</div>
            <div className="text-base">
              <ResponseView content={message.result} />
            </div>
          </div>
        )}

        {!isUser && message.steps && (
          <div className="mt-4 pt-3 border-t border-border/50 break-words">
            <div className="text-xs font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Step-by-step solution:</div>
            <ResponseView content={message.steps} />
          </div>
        )}
      </div>
    </div>
  );
};
