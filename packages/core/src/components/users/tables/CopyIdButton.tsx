"use client";

import { useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { useTranslations } from 'next-intl';

/**
 * Copies an id. It shows when the row is hovered or the button has focus (the row needs `group`), and the icon says it
 * was copied for a moment. A row click does not follow it.
 */
export function CopyIdButton({ id }: { id: string }) {
  const t = useTranslations('superadmin.shared');
  const [copied, setCopied] = useState(false);
  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The browser refused the clipboard (an insecure origin): the id stays selectable in the detail page
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? t('copied') : t('copyId')}
      title={copied ? t('copied') : t('copyId')}
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
      data-cy="copy-id"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
