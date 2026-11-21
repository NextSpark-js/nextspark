"use client";

import { Check, Copy, Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "../ui/button";
import { grepCommand, useCopy } from "./use-copy";

interface TagCopyActionsProps {
  /** The tag as written in the tests, with its `@`. */
  tag: string;
  tagCy: string;
  commandCy: string;
}

/** A tag with two labeled actions: copy the tag itself, or the command that runs only its tests. */
export function TagCopyActions({ tag, tagCy, commandCy }: TagCopyActionsProps) {
  const t = useTranslations("devtools.copy");
  const { copy, copied } = useCopy();
  const command = grepCommand(tag);

  return (
    <div className="flex items-center justify-between bg-muted rounded-md px-2 py-1 mt-auto">
      <code className="text-xs font-mono">{tag}</code>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => copy(tag)}
          title={t("tag")}
          aria-label={t("tag")}
          data-cy={tagCy}
        >
          {copied === tag ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => copy(command)}
          title={t("testCommand")}
          aria-label={t("testCommand")}
          data-cy={commandCy}
        >
          {copied === command ? <Check className="h-3 w-3 text-green-600" /> : <Terminal className="h-3 w-3" />}
        </Button>
      </div>
    </div>
  );
}
