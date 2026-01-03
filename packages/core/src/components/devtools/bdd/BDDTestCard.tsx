"use client";

import { useState } from "react";
import { Check, Copy, ChevronDown, Tag, Zap, TestTube2 } from "lucide-react";
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../ui/collapsible';
import { GherkinHighlighter } from "./GherkinHighlighter";
import type { BDDTestCase, BDDLanguage } from "./types";

interface BDDTestCardProps {
  test: BDDTestCase;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  language: BDDLanguage;
}

/**
 * BDDTestCard Component
 *
 * Displays a single BDD test case with collapsible content.
 * Features:
 * - Priority badge
 * - Type indicator
 * - Tags display
 * - Gherkin scenario with syntax highlighting
 * - Copy to clipboard
 * - Expected results list
 */
export function BDDTestCard({ test, index, isOpen, onToggle, language }: BDDTestCardProps) {
  const [copied, setCopied] = useState(false);

  // Get scenario for current language, fallback to other language or legacy field
  const currentScenario = test.scenarios?.[language] || test.scenarios?.en || test.scenarios?.es || test.scenario;

  const copyScenario = async () => {
    await navigator.clipboard.writeText(currentScenario);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'smoke':
        return <Zap className="h-3 w-3" />;
      case 'regression':
      case 'integration':
      case 'e2e':
        return <TestTube2 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <div
        className={cn(
          "border rounded-lg transition-colors",
          isOpen
            ? "border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20"
            : "border-border hover:border-violet-200 dark:hover:border-violet-800"
        )}
        data-cy={`bdd-test-${test.id}`}
      >
        <CollapsibleTrigger asChild>
          <button
            className="w-full px-4 py-3 flex items-center gap-3 text-left"
            data-cy={`bdd-test-trigger-${test.id}`}
          >
            <span className="text-xs font-mono text-muted-foreground min-w-[2rem]">
              {String(index + 1).padStart(2, '0')}
            </span>

            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-violet-600 dark:text-violet-400">
                  {test.id}
                </span>
                <span className="font-medium truncate">{test.title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {test.metadata.type && (
                <Badge variant="outline" className="text-xs gap-1">
                  {getTypeIcon(test.metadata.type)}
                  {test.metadata.type}
                </Badge>
              )}
              {test.metadata.priority && (
                <Badge className={cn("text-xs", getPriorityColor(test.metadata.priority))}>
                  {test.metadata.priority}
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {/* Tags */}
            {test.metadata.tags && test.metadata.tags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {test.metadata.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Scenario */}
            <div className="relative">
              <div className="absolute top-2 right-2 z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyScenario}
                  className="h-8 px-2 text-slate-400 hover:text-slate-200"
                  data-cy={`bdd-copy-${test.id}`}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <GherkinHighlighter code={currentScenario} />
            </div>

            {/* Expected Results */}
            {test.expectedResults && test.expectedResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Expected Results
                </h4>
                <ul className="space-y-1">
                  {test.expectedResults.map((result, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="text-green-500 mt-0.5">✓</span>
                      {result}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Notes */}
            {test.notes && (
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                {test.notes}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
