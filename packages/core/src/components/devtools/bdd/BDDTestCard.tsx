"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  ChevronDown,
  Tag,
  Zap,
  TestTube2,
  Terminal,
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  PlayCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../ui/collapsible';
import { GherkinHighlighter } from "./GherkinHighlighter";
import type { BDDTestCase, BDDLanguage, TestStatus } from "./types";

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

  const getStatusColor = (status?: TestStatus) => {
    switch (status) {
      case 'passing':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'failing':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'skipped':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'pending':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
      case 'active':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800';
    }
  };

  const getStatusIcon = (status?: TestStatus) => {
    switch (status) {
      case 'passing':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failing':
        return <XCircle className="h-3 w-3" />;
      case 'skipped':
        return <SkipForward className="h-3 w-3" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'active':
        return <PlayCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const copyGrepCommand = async (tag: string) => {
    const command = `pnpm cy:tags "${tag}"`;
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
              {test.metadata.status && (
                <Badge className={cn("text-xs gap-1", getStatusColor(test.metadata.status))}>
                  {getStatusIcon(test.metadata.status)}
                  {test.metadata.status}
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

            {/* Grep Tags */}
            {test.metadata.grepTags && test.metadata.grepTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Terminal className="h-3 w-3 text-emerald-500" />
                {test.metadata.grepTags.map((tag) => (
                  <Badge
                    key={tag}
                    className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                    onClick={() => copyGrepCommand(tag)}
                    title={`Click to copy: pnpm cy:tags "${tag}"`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Status Reason */}
            {test.metadata.statusReason && (
              <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md px-3 py-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{test.metadata.statusReason}</span>
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
