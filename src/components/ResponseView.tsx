import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ResponseViewProps {
  content: string;
}

export const ResponseView = ({ content }: ResponseViewProps) => {
  return (
    <div className="max-w-none leading-relaxed text-white break-words overflow-wrap-anywhere">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            return isInline ? (
              <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm text-emerald-400" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-3 max-w-full">
                <code className={`${className} text-sm text-emerald-400 block`} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          p({ children }) {
            return <p className="mb-3 last:mb-0 break-words">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 mt-4 text-white break-words">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 mt-3 text-white break-words">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mb-2 mt-2 text-white break-words">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-3 space-y-1.5 ml-2">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-3 space-y-1.5 ml-2">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-white break-words leading-relaxed">{children}</li>;
          },
          blockquote({ children }) {
            return <blockquote className="border-l-4 border-emerald-500 pl-4 italic my-3 text-gray-300">{children}</blockquote>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
