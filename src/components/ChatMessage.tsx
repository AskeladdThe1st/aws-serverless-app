import ResponseView from './ResponseView';

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

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
      <div
        className={`w-full max-w-full md:max-w-[85%] lg:max-w-[75%] rounded-2xl px-6 py-4 ${
          isUser
            ? 'bg-[#2f2f2f] text-white'
            : 'bg-[#2f2f2f] text-white'
        }`}
      >
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
