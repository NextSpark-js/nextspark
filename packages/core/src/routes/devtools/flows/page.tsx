import { Suspense } from "react";
import { FlowsViewer } from "@nextsparkjs/core/components/devtools/FlowsViewer";
import { GitBranch } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

/**
 * Flows Registry Page
 *
 * Displays all user journey flows from the testing registry with coverage information.
 * Provides filtering and search capabilities.
 */
async function DevFlowsPageContent() {
  const t = await getTranslations("devtools.flows");

  return (
    <div className="space-y-6" data-cy="devtools-flows-page">
      {/* Header */}
      <AreaPageHeader icon={GitBranch} title={t("title")} subtitle={t("description")} />

      {/* Flows Viewer */}
      <FlowsViewer />
    </div>
  );
}

export default function DevFlowsPage() {
  return (
    <Suspense fallback={null}>
      <DevFlowsPageContent />
    </Suspense>
  );
}
