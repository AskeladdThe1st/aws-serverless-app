import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import ResponseView from './ResponseView';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  expression?: string;
  result?: string;
  steps?: string;
  imageUrl?: string;
  imageUrls?: string[]; // Support multiple images
  image_preview?: string; // Base64 image from backend for clarification
}

interface ChatMessageProps {
  message: Message;
  userAvatarUrl?: string;
  assistantAvatarUrl?: string;
  userFallback?: string;
  assistantName?: string;
}

export const ChatMessage = ({
  message,
  userAvatarUrl,
  assistantAvatarUrl,
  userFallback,
  assistantName,
}: ChatMessageProps) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const avatarUrl = isUser ? userAvatarUrl : assistantAvatarUrl;
  const fallback = isUser
    ? (userFallback || 'U')
    : (assistantName?.charAt(0).toUpperCase() || 'A');

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
      <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        <Avatar className="h-9 w-9 mt-1 shadow-sm">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={isUser ? 'You' : assistantName || 'Tutor'} />}
          <AvatarFallback className="bg-muted text-foreground/80">{fallback}</AvatarFallback>
        </Avatar>
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

          {/* Display image preview from backend for clarification (before question) */}
          {message.image_preview && (
            <img
              src={`data:image/png;base64,${message.image_preview}`}
              alt="Graph preview"
              className="rounded-lg mb-3 border border-border object-contain"
              style={{ maxWidth: '300px', maxHeight: '300px', width: 'auto', height: 'auto' }}
            />
          )}

          {/* Display multiple images if available - uniform 300px max dimensions */}
          {message.imageUrls && message.imageUrls.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              {message.imageUrls.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Uploaded ${idx + 1}`}
                  className="rounded-lg border border-border object-contain"
                  style={{ maxWidth: '300px', maxHeight: '300px', width: 'auto', height: 'auto' }}
                />
              ))}
            </div>
          )}

          {/* Fallback for single imageUrl (backwards compatibility) */}
          {!message.imageUrls && message.imageUrl && (
            <img
              src={message.imageUrl}
              alt="Uploaded"
              className="rounded-lg mb-2 border border-border object-contain"
              style={{ maxWidth: '300px', maxHeight: '300px', width: 'auto', height: 'auto' }}
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
    </div>
  );
};
