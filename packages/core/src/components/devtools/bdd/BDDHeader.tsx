"use client";

import { TestTube2, Tag, AlertTriangle, CheckCircle2, Languages } from "lucide-react";
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import type { BDDFeature, BDDLanguage } from "./types";

interface BDDHeaderProps {
  feature: BDDFeature;
  testCount: number;
  language: BDDLanguage;
  onLanguageChange: (lang: BDDLanguage) => void;
  hasMultipleLanguages: boolean;
}

/**
 * BDDHeader Component
 *
 * Displays the feature header with title, description, and statistics.
 */
export function BDDHeader({ feature, testCount, language, onLanguageChange, hasMultipleLanguages }: BDDHeaderProps) {
  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <CheckCircle2 className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4" data-cy="bdd-header">
      {/* Title Section */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TestTube2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            <h1 className="text-2xl font-bold">{feature.title}</h1>
          </div>
          {feature.description && (
            <p className="text-muted-foreground">{feature.description}</p>
          )}
        </div>

        {feature.priority && (
          <Badge
            className={cn(
              "shrink-0",
              feature.priority === 'high' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
              feature.priority === 'medium' && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
              feature.priority === 'low' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}
          >
            {getPriorityIcon(feature.priority)}
            <span className="ml-1">{feature.priority} priority</span>
          </Badge>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30">
              <span className="font-bold text-violet-600 dark:text-violet-400">{testCount}</span>
            </div>
            <span className="text-muted-foreground">Test Cases</span>
          </div>

          {feature.tags && feature.tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-1 flex-wrap">
                {feature.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {feature.grepTags && feature.grepTags.length > 0 && (
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground">grep:</code>
              <div className="flex items-center gap-1 flex-wrap">
                {feature.grepTags.map((tag) => {
                  const displayTag = tag.startsWith('@') ? tag : `@${tag}`;
                  return (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-xs font-mono bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                      onClick={() => navigator.clipboard.writeText(displayTag)}
                      title="Click to copy"
                    >
                      {displayTag}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Language Toggle */}
        {hasMultipleLanguages && (
          <div className="flex items-center gap-2" data-cy="bdd-language-toggle">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <div className="flex rounded-lg border border-border overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-none px-3 h-8 text-xs font-medium",
                  language === 'en'
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onLanguageChange('en')}
                data-cy="bdd-lang-en"
              >
                EN
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-none px-3 h-8 text-xs font-medium border-l border-border",
                  language === 'es'
                    ? "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => onLanguageChange('es')}
                data-cy="bdd-lang-es"
              >
                ES
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
