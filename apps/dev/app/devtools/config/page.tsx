import { ConfigViewer } from "@nextsparkjs/core/components/devtools";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Configuration Viewer Page
 *
 * Displays theme configuration and entity registry information.
 * Provides read-only view with JSON formatting and copy functionality.
 */
export default async function DevConfigPage() {
  const t = await getTranslations('dev.config');

  return (
    <div className="space-y-6" data-cy="devtools-config-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <Settings className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {/* Config Viewer */}
      <ConfigViewer />
    </div>
  );
}
