import { FeaturesViewer } from "@nextsparkjs/core/components/devtools/FeaturesViewer";
import { Layers } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Features Registry Page
 *
 * Displays all features from the testing registry with coverage information.
 * Provides filtering and search capabilities.
 */
export default async function DevFeaturesPage() {
  const t = await getTranslations("devtools.features");

  return (
    <div className="space-y-6" data-cy="devtools-features-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Layers className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Features Viewer */}
      <FeaturesViewer />
    </div>
  );
}
