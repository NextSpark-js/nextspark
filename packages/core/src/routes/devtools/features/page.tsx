import { Suspense } from "react";
import { FeaturesViewer } from "@nextsparkjs/core/components/devtools/FeaturesViewer";
import { Layers } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

/**
 * Features Registry Page
 *
 * Displays all features from the testing registry with coverage information.
 * Provides filtering and search capabilities.
 */
async function DevFeaturesPageContent() {
  const t = await getTranslations("devtools.features");

  return (
    <div className="space-y-6" data-cy="devtools-features-page">
      {/* Header */}
      <AreaPageHeader icon={Layers} title={t("title")} subtitle={t("description")} />

      {/* Features Viewer */}
      <FeaturesViewer />
    </div>
  );
}

export default function DevFeaturesPage() {
  return (
    <Suspense fallback={null}>
      <DevFeaturesPageContent />
    </Suspense>
  );
}
