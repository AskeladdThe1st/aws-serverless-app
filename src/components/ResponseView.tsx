import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ResponseViewProps {
  content: string;
}

export const ResponseView = ({ content }: ResponseViewProps) => {
  return (
    <div className="prose prose-invert max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const isInline = !className;
            return isInline ? (
              <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-3">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          p({ children }) {
            return <p className="mb-2 last:mb-0">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-white">{children}</strong>;
          },
          h1({ children }) {
            return <h1 className="text-xl font-bold mb-3 text-white">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-lg font-bold mb-2 text-white">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="text-base font-semibold mb-2 text-white">{children}</h3>;
          },
          ul({ children }) {
            return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-white">{children}</li>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
