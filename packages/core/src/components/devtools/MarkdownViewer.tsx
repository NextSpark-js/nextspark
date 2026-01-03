"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useState, memo } from "react";
import { codeToHtml } from "shiki";
import { cn } from '../../lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

interface ShikiCodeBlockProps {
  code: string;
  language: string;
}

/**
 * ShikiCodeBlock Component
 *
 * Renders code with syntax highlighting using Shiki.
 * Lazy-loads the highlighting for better performance.
 */
const ShikiCodeBlock = memo(function ShikiCodeBlock({
  code,
  language,
}: ShikiCodeBlockProps) {
  const [html, setHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    codeToHtml(code, {
      lang: language || "text",
      theme: "github-dark",
    })
      .then((result) => {
        if (mounted) {
          setHtml(result);
          setIsLoading(false);
        }
      })
      .catch(() => {
        // Fallback si el lenguaje no está soportado
        if (mounted) {
          setHtml("");
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [code, language]);

  if (isLoading) {
    return (
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  if (!html) {
    return (
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-md overflow-x-auto">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="[&_pre]:!m-0 [&_pre]:!rounded-md [&_pre]:!p-4 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * MarkdownViewer Component
 *
 * Renders markdown content with syntax highlighting for code blocks.
 * Used in the Test Cases viewer to display BDD test documentation.
 *
 * Features:
 * - Syntax highlighting for code blocks (using Shiki - ~25KB vs 296KB)
 * - GitHub Flavored Markdown (tables, strikethrough, etc.)
 * - Responsive typography
 * - Dark mode support
 * - Native Gherkin syntax support
 */
export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:text-violet-600 dark:prose-headings:text-violet-400",
        "prose-a:text-violet-600 dark:prose-a:text-violet-400",
        "prose-code:text-pink-600 dark:prose-code:text-pink-400",
        "prose-pre:bg-slate-900 prose-pre:text-slate-100",
        // Table styles
        "prose-table:border-collapse prose-table:w-full",
        "prose-th:border prose-th:border-border prose-th:bg-muted prose-th:p-2 prose-th:text-left",
        "prose-td:border prose-td:border-border prose-td:p-2 prose-td:align-top",
        className
      )}
      data-cy="devtools-tests-markdown-content"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";
            const isInline = !match;

            if (!isInline && language) {
              const code = String(children).replace(/\n$/, "");
              return <ShikiCodeBlock code={code} language={language} />;
            }

            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
