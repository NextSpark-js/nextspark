"use client";

import { useMemo } from "react";
import { cn } from '../../../lib/utils';

interface GherkinHighlighterProps {
  code: string;
  className?: string;
}

interface TokenizedLine {
  keyword?: string;
  keywordType?: 'given' | 'when' | 'then' | 'and' | 'but' | 'scenario' | 'feature' | 'background';
  content: string;
}

/**
 * GherkinHighlighter Component
 *
 * Provides syntax highlighting for Gherkin/Cucumber scenarios.
 * Colors:
 * - Given/And (preconditions): Blue
 * - When (actions): Green
 * - Then (assertions): Purple
 * - Scenario/Feature: Orange
 */
export function GherkinHighlighter({ code, className }: GherkinHighlighterProps) {
  const tokenizedLines = useMemo(() => {
    return code.split('\n').map((line): TokenizedLine => {
      const trimmed = line.trim();

      // Check for keywords
      const keywordPatterns: Array<{ pattern: RegExp; type: TokenizedLine['keywordType'] }> = [
        { pattern: /^(Given)\s+/i, type: 'given' },
        { pattern: /^(When)\s+/i, type: 'when' },
        { pattern: /^(Then)\s+/i, type: 'then' },
        { pattern: /^(And)\s+/i, type: 'and' },
        { pattern: /^(But)\s+/i, type: 'but' },
        { pattern: /^(Scenario(?:\s+Outline)?:?)\s*/i, type: 'scenario' },
        { pattern: /^(Feature:)\s*/i, type: 'feature' },
        { pattern: /^(Background:)\s*/i, type: 'background' },
      ];

      for (const { pattern, type } of keywordPatterns) {
        const match = trimmed.match(pattern);
        if (match) {
          return {
            keyword: match[1],
            keywordType: type,
            content: trimmed.slice(match[0].length),
          };
        }
      }

      return { content: line };
    });
  }, [code]);

  const getKeywordColor = (type: TokenizedLine['keywordType']): string => {
    switch (type) {
      case 'given':
        return 'text-blue-500 dark:text-blue-400';
      case 'when':
        return 'text-green-500 dark:text-green-400';
      case 'then':
        return 'text-purple-500 dark:text-purple-400';
      case 'and':
      case 'but':
        return 'text-slate-500 dark:text-slate-400';
      case 'scenario':
      case 'feature':
      case 'background':
        return 'text-orange-500 dark:text-orange-400';
      default:
        return '';
    }
  };

  return (
    <pre
      className={cn(
        "bg-slate-900 dark:bg-slate-950 rounded-lg p-4 overflow-x-auto text-sm font-mono",
        className
      )}
    >
      <code>
        {tokenizedLines.map((line, index) => (
          <div key={index} className="leading-relaxed">
            {line.keyword ? (
              <>
                <span className={cn("font-semibold", getKeywordColor(line.keywordType))}>
                  {line.keyword}
                </span>
                <span className="text-slate-300 dark:text-slate-200">
                  {' '}{highlightParameters(line.content)}
                </span>
              </>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">
                {line.content || '\u00A0'}
              </span>
            )}
          </div>
        ))}
      </code>
    </pre>
  );
}

/**
 * Highlight parameters in quotes and data table values
 */
function highlightParameters(text: string): React.ReactNode {
  // Match quoted strings and <placeholders>
  const parts = text.split(/(".*?"|<\w+>)/g);

  return parts.map((part, index) => {
    if (part.startsWith('"') && part.endsWith('"')) {
      return (
        <span key={index} className="text-amber-400 dark:text-amber-300">
          {part}
        </span>
      );
    }
    if (part.startsWith('<') && part.endsWith('>')) {
      return (
        <span key={index} className="text-cyan-400 dark:text-cyan-300 italic">
          {part}
        </span>
      );
    }
    return part;
  });
}
