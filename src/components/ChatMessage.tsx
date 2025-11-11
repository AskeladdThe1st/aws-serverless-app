import { useState } from 'react';
import ResponseView from './ResponseView';
import { Message } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const ChatMessage = ({ message }: { message: Message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Extract plain text from the message
      let textToCopy = message.content;
      
      if (message.expression) {
        textToCopy += `\n\nExpression: ${message.expression}`;
      }
      if (message.result) {
        textToCopy += `\n\nResult: ${message.result}`;
      }
      if (message.steps) {
        textToCopy += `\n\nSteps: ${message.steps}`;
      }
      
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Copied ✅');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div
        className={`relative w-full max-w-full md:max-w-[85%] lg:max-w-[75%] rounded-2xl px-6 py-4 ${
          isUser
            ? 'bg-[#2f2f2f] text-white'
            : 'bg-[#2f2f2f] text-white'
        }`}
      >
        {/* Copy button for assistant messages */}
        {!isUser && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopy}
                className="absolute top-2 right-2 h-8 w-8 opacity-50 hover:opacity-100 transition-opacity"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{copied ? 'Copied!' : 'Copy solution'}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {message.imageUrl && (
          <img 
            src={message.imageUrl} 
            alt="Uploaded" 
            className="max-w-full rounded-lg mb-3 border border-[#444]"
          />
        )}
        
        <ResponseView content={message.content} />

        {isUser && message.expression && (
          <div className="mt-4 pt-4 border-t border-[#444]">
            <div className="text-xs font-semibold mb-2 text-[#8e8e8e]">Expression:</div>
            <div className="font-mono text-sm bg-[#1a1a1a] rounded p-2 mb-3">
              <ResponseView content={`$$${message.expression}$$`} />
            </div>
          </div>
        )}

        {message.result && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2 text-[#8e8e8e]">Result:</div>
            <div className="text-base font-semibold">
              <ResponseView content={message.result} />
            </div>
          </div>
        )}

        {message.steps && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2 text-[#8e8e8e]">Step-by-step solution:</div>
            <ResponseView content={message.steps} />
          </div>
        )}
      </div>
    </div>
  );
};
