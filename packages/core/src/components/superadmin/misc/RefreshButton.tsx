"use client";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "../../ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { formatLocaleDate } from "../../../lib/i18n/format";

export interface RefreshMetadata {
  requestedAt: string;
  requestedBy: string;
  source: string;
}

/**
 * The Refresh button of the superadmin pages. What used to be a debug footer ("Last updated / Requested by / Source")
 * is its tooltip (#530).
 */
export function RefreshButton({ onRefresh, metadata }: { onRefresh: () => void; metadata?: RefreshMetadata }) {
  const t = useTranslations("superadmin.shared");
  const locale = useLocale();
  const button = (
    <Button onClick={onRefresh} variant="outline" size="sm" className="flex items-center gap-2" data-cy="refresh-btn">
      <RefreshCw className="h-4 w-4" />
      {t("refresh")}
    </Button>
  );
  if (!metadata) return button;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent className="space-y-0.5">
          <p>{t("footer.lastUpdated", { date: formatLocaleDate(metadata.requestedAt, locale, "dateTime") })}</p>
          <p>{t("footer.requestedBy", { name: metadata.requestedBy })}</p>
          <p>{t("footer.source", { source: metadata.source })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
