"use client";

import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Clock,
  PlayCircle,
} from "lucide-react";
import { cn } from '../../../lib/utils';
import type { BDDTestCase, TestStatus } from "./types";

interface BDDTableOfContentsProps {
  tests: BDDTestCase[];
  activeTestId: string | null;
  onSelectTest: (testId: string) => void;
}

/**
 * BDDTableOfContents Component
 *
 * Navigation sidebar for jumping to specific test cases.
 */
export function BDDTableOfContents({
  tests,
  activeTestId,
  onSelectTest,
}: BDDTableOfContentsProps) {
  const getPriorityDot = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-slate-400';
    }
  };

  const getStatusIcon = (status?: TestStatus) => {
    const iconClass = "h-3.5 w-3.5 shrink-0";
    switch (status) {
      case 'passing':
        return <CheckCircle2 className={cn(iconClass, "text-green-500")} />;
      case 'failing':
        return <XCircle className={cn(iconClass, "text-red-500")} />;
      case 'skipped':
        return <SkipForward className={cn(iconClass, "text-amber-500")} />;
      case 'pending':
        return <Clock className={cn(iconClass, "text-slate-400")} />;
      case 'active':
        return <PlayCircle className={cn(iconClass, "text-blue-500")} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2" data-cy="bdd-toc">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-2">
        Test Cases
      </h3>
      <nav className="space-y-1">
        {tests.map((test, index) => (
          <button
            key={test.id}
            onClick={() => onSelectTest(test.id)}
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "flex items-center gap-2",
              activeTestId === test.id
                ? "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-100"
                : "text-muted-foreground"
            )}
            data-cy={`bdd-toc-item-${test.id}`}
          >
            {/* Show status icon if available, otherwise show priority dot */}
            {test.metadata.status ? (
              getStatusIcon(test.metadata.status)
            ) : (
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  getPriorityDot(test.metadata.priority)
                )}
              />
            )}
            <span className="font-mono text-xs text-muted-foreground shrink-0">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="truncate">{test.title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
