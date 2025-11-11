import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ResponseViewProps {
  content: string;
}

// Normalize common math delimiters from LLMs (\(...\), \[...\]) to $...$ and $$...$$.
// Skips fenced code blocks to avoid mangling code samples.
// Also removes SymPy verification sections.
function normalizeMathDelimiters(input: string): string {
  // Remove SymPy verification section (including variations in casing and formatting)
  let cleaned = input
    .replace(/verification with sympy[\s\S]*?(?=\n\n[A-Z]|\n\n$|$)/gi, '')
    .replace(/```python[\s\S]*?from sympy[\s\S]*?```/gi, '')
    .replace(/###?\s*verification[\s\S]*?(?=\n\n[A-Z#]|\n\n$|$)/gi, '');
  
  const parts = cleaned.split(/```/); // odd indices are inside code fences
  const converted = parts.map((segment, idx) => {
    if (idx % 2 === 1) return segment; // inside code block, leave as-is
    return segment
      // display math: \[ ... \] -> $$ ... $$
      .replace(/\\\[(.*?)\\\]/gs, (_, m: string) => `$$${m}$$`)
      // inline math: \( ... \) -> $ ... $
      .replace(/\\\((.*?)\\\)/gs, (_, m: string) => `$${m}$`);
  });
  return converted.join('```');
}

export default function ResponseView({ content }: ResponseViewProps) {
  const normalized = useMemo(() => normalizeMathDelimiters(content || ''), [content]);

  return (
    <div className="max-w-none leading-relaxed text-white break-words overflow-wrap-anywhere">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ children, className }) {
            const isBlock = Boolean(className && /language-/.test(className));
            if (isBlock) {
              return (
                <pre className="bg-[#1a1a1a] rounded-lg p-4 overflow-x-auto my-3 max-w-full">
                  <code className={`${className} text-sm text-emerald-400 block`}>{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-sm text-emerald-400">{children}</code>
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
            return (
              <blockquote className="border-l-4 border-emerald-500 pl-4 italic my-3 text-gray-300">{children}</blockquote>
            );
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
