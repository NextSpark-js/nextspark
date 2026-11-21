import { Suspense } from "react";
import { BlocksViewer } from "@nextsparkjs/core/components/devtools/BlocksViewer";
import { LayoutGrid } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

/**
 * Blocks Registry Page
 *
 * Displays all page builder blocks with field definitions and coverage info.
 * Provides filtering and search capabilities.
 */
async function DevBlocksPageContent() {
  const t = await getTranslations("devtools.blocks");

  return (
    <div className="space-y-6" data-cy="devtools-blocks-page">
      {/* Header */}
      <AreaPageHeader icon={LayoutGrid} title={t("title")} subtitle={t("description")} />

      {/* Blocks Viewer */}
      <BlocksViewer />
    </div>
  );
}

export default function DevBlocksPage() {
  return (
    <Suspense fallback={null}>
      <DevBlocksPageContent />
    </Suspense>
  );
}
