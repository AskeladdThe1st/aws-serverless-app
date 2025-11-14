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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div
        className={`relative group w-full max-w-full md:max-w-[85%] lg:max-w-[75%] rounded-2xl px-6 py-4 break-words overflow-hidden ${
          isUser
            ? 'bg-muted text-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {/* Copy Button - Only show for assistant messages with solutions */}
        {!isUser && (message.result || message.steps) && (
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 p-2 rounded-lg bg-background hover:bg-background/80 opacity-0 group-hover:opacity-100 transition-all"
            aria-label="Copy solution"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
        {message.imageUrl && (
          <img 
            src={message.imageUrl} 
            alt="Uploaded" 
            className="max-w-full rounded-lg mb-3 border border-border"
          />
        )}
        
        <div className="break-words overflow-hidden">
          <ResponseView content={message.content} />
        </div>

        {isUser && message.expression && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Expression:</div>
            <div className="font-mono text-sm bg-background rounded p-2 mb-3 break-words overflow-x-auto">
              <ResponseView content={`$$${message.expression}$$`} />
            </div>
          </div>
        )}

        {message.result && (
          <div className="mt-3 break-words">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Result:</div>
            <div className="text-base font-semibold">
              <ResponseView content={message.result} />
            </div>
          </div>
        )}

        {message.steps && (
          <div className="mt-3 break-words">
            <div className="text-xs font-semibold mb-2 text-muted-foreground">Step-by-step solution:</div>
            <ResponseView content={message.steps} />
          </div>
        )}
      </div>
    </div>
  );
};
