import { BlocksViewer } from "@nextsparkjs/core/components/devtools/BlocksViewer";
import { LayoutGrid } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Blocks Registry Page
 *
 * Displays all page builder blocks with field definitions and coverage info.
 * Provides filtering and search capabilities.
 */
export default async function DevBlocksPage() {
  const t = await getTranslations("devtools.blocks");

  return (
    <div className="space-y-6" data-cy="devtools-blocks-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <LayoutGrid className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Blocks Viewer */}
      <BlocksViewer />
    </div>
  );
}
