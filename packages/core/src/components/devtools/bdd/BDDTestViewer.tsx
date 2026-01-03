"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Input } from '../../ui/input';
import { Search, ExpandIcon, ShrinkIcon } from "lucide-react";
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { cn } from '../../../lib/utils';
import { parseBDDDocument } from "./parser";
import { BDDHeader } from "./BDDHeader";
import { BDDTestCard } from "./BDDTestCard";
import { BDDTableOfContents } from "./BDDTableOfContents";
import type { BDDDocument, BDDLanguage } from "./types";
import { useTranslations } from "next-intl";

const LANGUAGE_STORAGE_KEY = 'bdd-viewer-language';

interface BDDTestViewerProps {
  content: string;
  className?: string;
}

/**
 * BDDTestViewer Component
 *
 * Main component for viewing BDD test documentation.
 * Features:
 * - Feature header with stats
 * - Collapsible test cases
 * - Table of contents navigation (sticky on scroll)
 * - Search/filter functionality
 * - Expand/collapse all
 */
export function BDDTestViewer({ content, className }: BDDTestViewerProps) {
  const t = useTranslations('devtools.tests');
  const [document, setDocument] = useState<BDDDocument | null>(null);
  const [openTests, setOpenTests] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const testRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Language state with localStorage persistence
  const [language, setLanguage] = useState<BDDLanguage>('en');

  // Load saved language preference on mount
  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as BDDLanguage | null;
    if (saved && (saved === 'en' || saved === 'es')) {
      setLanguage(saved);
    }
  }, []);

  // Handle language change with persistence
  const handleLanguageChange = useCallback((lang: BDDLanguage) => {
    setLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  }, []);

  // Parse document on mount or content change
  useEffect(() => {
    const parsed = parseBDDDocument(content);
    setDocument(parsed);
    // Auto-open and select first test
    if (parsed.tests.length > 0) {
      setOpenTests(new Set([parsed.tests[0].id]));
      setActiveTestId(parsed.tests[0].id);
    }
  }, [content]);

  // Check if document has multiple languages
  const hasMultipleLanguages = useMemo(() => {
    if (!document) return false;
    return document.tests.some(test =>
      test.scenarios?.en && test.scenarios?.es
    );
  }, [document]);

  // Filter tests based on search
  const filteredTests = useMemo(() => {
    if (!document) return [];
    if (!searchQuery.trim()) return document.tests;

    const query = searchQuery.toLowerCase();
    return document.tests.filter((test) => {
      return (
        test.id.toLowerCase().includes(query) ||
        test.title.toLowerCase().includes(query) ||
        test.scenario.toLowerCase().includes(query) ||
        test.metadata.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [document, searchQuery]);

  const handleToggleTest = useCallback((testId: string) => {
    setOpenTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
    setActiveTestId(testId);
  }, []);

  const handleSelectTest = useCallback((testId: string) => {
    // Open the test if not already open
    setOpenTests((prev) => {
      const next = new Set(prev);
      next.add(testId);
      return next;
    });
    setActiveTestId(testId);

    // Scroll to the test
    requestAnimationFrame(() => {
      const ref = testRefs.current.get(testId);
      if (ref) {
        ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    if (!document) return;
    setOpenTests(new Set(document.tests.map((t) => t.id)));
  }, [document]);

  const handleCollapseAll = useCallback(() => {
    setOpenTests(new Set());
  }, []);

  if (!document) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const allExpanded = document.tests.length > 0 && openTests.size === document.tests.length;

  const hasTOC = document.tests.length > 3;

  return (
    <div className={cn("flex gap-6 h-full", className)} data-cy="bdd-test-viewer">
      {/* Main Content - Scrollable */}
      <div className="flex-1 min-w-0 space-y-6 overflow-y-auto pr-2">
        {/* Header */}
        <BDDHeader
          feature={document.feature}
          testCount={document.tests.length}
          language={language}
          onLanguageChange={handleLanguageChange}
          hasMultipleLanguages={hasMultipleLanguages}
        />

        <Separator />

        {/* Toolbar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-cy="bdd-search"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}
              data-cy="bdd-expand-toggle"
            >
              {allExpanded ? (
                <>
                  <ShrinkIcon className="h-4 w-4 mr-2" />
                  {t('collapseAll')}
                </>
              ) : (
                <>
                  <ExpandIcon className="h-4 w-4 mr-2" />
                  {t('expandAll')}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Test Cases */}
        <div className="space-y-3 pb-6">
          {filteredTests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? t('noMatchingTests') : t('noTests')}
            </div>
          ) : (
            filteredTests.map((test, index) => (
              <div
                key={test.id}
                data-test-id={test.id}
                ref={(el) => {
                  if (el) testRefs.current.set(test.id, el);
                }}
              >
                <BDDTestCard
                  test={test}
                  index={index}
                  isOpen={openTests.has(test.id)}
                  onToggle={() => handleToggleTest(test.id)}
                  language={language}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Table of Contents Sidebar - Fixed position relative to flex container */}
      {hasTOC && (
        <aside className="hidden lg:block w-64 shrink-0 self-start sticky top-0">
          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto">
            <BDDTableOfContents
              tests={document.tests}
              activeTestId={activeTestId}
              onSelectTest={handleSelectTest}
            />
          </div>
        </aside>
      )}
    </div>
  );
}
