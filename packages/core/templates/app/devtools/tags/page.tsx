import { TagsOverview } from "@nextsparkjs/core/components/devtools/TagsOverview";
import { Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Tags Overview Page
 *
 * Displays all test tags organized by category.
 * Provides search and copy-to-clipboard functionality.
 */
export default async function DevTagsPage() {
  const t = await getTranslations("devtools.tags");

  return (
    <div className="space-y-6" data-cy="devtools-tags-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Tag className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Tags Overview */}
      <TagsOverview />
    </div>
  );
}
