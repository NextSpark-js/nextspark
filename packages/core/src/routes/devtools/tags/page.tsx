import { Suspense } from "react";
import { TagsOverview } from "@nextsparkjs/core/components/devtools/TagsOverview";
import { Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

/**
 * Tags Overview Page
 *
 * Displays all test tags organized by category.
 * Provides search and copy-to-clipboard functionality.
 */
async function DevTagsPageContent() {
  const t = await getTranslations("devtools.tags");

  return (
    <div className="space-y-6" data-cy="devtools-tags-page">
      {/* Header */}
      <AreaPageHeader icon={Tag} title={t("title")} subtitle={t("description")} />

      {/* Tags Overview */}
      <TagsOverview />
    </div>
  );
}

export default function DevTagsPage() {
  return (
    <Suspense fallback={null}>
      <DevTagsPageContent />
    </Suspense>
  );
}
