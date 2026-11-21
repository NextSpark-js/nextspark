"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

/** The grep command that runs only the tests of `tag` (with its `@`). */
export function grepCommand(tag: string): string {
  return `npx cypress run --env grepTags="${tag}"`;
}

/**
 * Copy to the clipboard with feedback every devtools copy shares: a "Copied" toast, and `copied` holding the id of
 * what was copied for ~2 s so the button can show a check. A failed write (no clipboard permission) says so.
 */
export function useCopy() {
  const t = useTranslations("devtools.copy");
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = useCallback(
    async (text: string, id: string = text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        toast.error(t("failed"));
        return;
      }
      toast.success(t("copied"));
      setCopied(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 2000);
    },
    [t]
  );

  return { copy, copied };
}
