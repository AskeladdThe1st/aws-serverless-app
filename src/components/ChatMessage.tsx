import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

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
  
  const renderMath = (text: string) => {
    // Split by display math ($$...$$ or \[...\])
    const parts = text.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/);
    
    return parts.map((part, index) => {
      // Display math
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2);
        return <BlockMath key={index} math={math} />;
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        const math = part.slice(2, -2);
        return <BlockMath key={index} math={math} />;
      }
      
      // Inline math ($...$ or \(...\))
      const inlineParts = part.split(/(\$[^\$]+\$|\\\([^\)]+\\\))/);
      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
          const math = inlinePart.slice(1, -1);
          return <InlineMath key={`${index}-${inlineIndex}`} math={math} />;
        }
        if (inlinePart.startsWith('\\(') && inlinePart.endsWith('\\)')) {
          const math = inlinePart.slice(2, -2);
          return <InlineMath key={`${index}-${inlineIndex}`} math={math} />;
        }
        return <span key={`${index}-${inlineIndex}`}>{inlinePart}</span>;
      });
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div
        className={`max-w-[80%] rounded-2xl px-6 py-4 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground'
        } transition-all duration-300 hover:shadow-lg`}
        style={isUser ? { boxShadow: 'var(--shadow-glow)' } : {}}
      >
        {message.imageUrl && (
          <img 
            src={message.imageUrl} 
            alt="Uploaded" 
            className="max-w-full rounded-lg mb-3 border border-border"
          />
        )}
        
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {renderMath(message.content)}
        </div>

        {message.expression && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-xs font-semibold mb-2 opacity-80">Expression:</div>
            <div className="font-mono text-sm bg-background/30 rounded p-2 mb-3">
              {renderMath(`$$${message.expression}$$`)}
            </div>
          </div>
        )}

        {message.result && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2 opacity-80">Result:</div>
            <div className="text-base font-semibold">
              {renderMath(message.result)}
            </div>
          </div>
        )}

        {message.steps && (
          <div className="mt-3">
            <div className="text-xs font-semibold mb-2 opacity-80">Step-by-step solution:</div>
            <div className="text-sm leading-relaxed">
              {renderMath(message.steps)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
