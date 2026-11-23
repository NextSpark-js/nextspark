import { Suspense } from "react";
import { ConfigViewer } from "@nextsparkjs/core/components/devtools/ConfigViewer";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

/**
 * Configuration Viewer Page
 *
 * Displays theme configuration and entity registry information.
 * Provides read-only view with JSON formatting and copy functionality.
 */
async function DevConfigPageContent() {
  const t = await getTranslations('devtools.config');

  return (
    <div className="space-y-6" data-cy="devtools-config-page">
      {/* Header */}
      <AreaPageHeader icon={Settings} title={t('title')} subtitle={t('description')} />

      {/* Config Viewer */}
      <ConfigViewer />
    </div>
  );
}

export default function DevConfigPage() {
  return (
    <Suspense fallback={null}>
      <DevConfigPageContent />
    </Suspense>
  );
}
