import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ResponseViewProps {
  content: string;
}

export default function ResponseView({ content }: ResponseViewProps) {
  return (
    <div className="prose prose-invert max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ children, className }) {
            return (
              <pre className="bg-gray-900 text-green-300 rounded p-3 overflow-x-auto my-3">
                <code className={className}>{children}</code>
              </pre>
            );
          },
          p({ children }) {
            return <p className="mb-3">{children}</p>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-gray-100">{children}</strong>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
