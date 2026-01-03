import { FlowsViewer } from "@nextsparkjs/core/components/devtools/FlowsViewer";
import { GitBranch } from "lucide-react";
import { getTranslations } from "next-intl/server";

/**
 * Flows Registry Page
 *
 * Displays all user journey flows from the testing registry with coverage information.
 * Provides filtering and search capabilities.
 */
export default async function DevFlowsPage() {
  const t = await getTranslations("devtools.flows");

  return (
    <div className="space-y-6" data-cy="devtools-flows-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <GitBranch className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Flows Viewer */}
      <FlowsViewer />
    </div>
  );
}
