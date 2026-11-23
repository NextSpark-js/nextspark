import { Suspense } from "react";
import { TestCasesViewer } from "@nextsparkjs/core/components/devtools/TestCasesViewer";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AreaPageHeader } from "@nextsparkjs/core/components/area/AreaPageHeader";

interface DevTestsPageProps {
  params: Promise<{ path?: string[] }>;
}

/**
 * Test Cases Page (Catch-all route)
 *
 * Displays test documentation viewer with file tree and markdown rendering.
 * Shows all test case files from tests/cypress/e2e/**\/*.md
 *
 * URL Examples:
 * - /dev/tests                                    → No selection
 * - /dev/tests/auth/login-logout.bdd.md          → File selected
 * - /dev/tests/page-builder/admin/block-editor.bdd.md → Nested file
 */
async function DevTestsPageContent({ params }: DevTestsPageProps) {
  const { path } = await params;
  const t = await getTranslations("devtools.tests");

  // Convert path array to string (e.g., ['auth', 'login.bdd.md'] -> 'auth/login.bdd.md')
  const initialPath = path?.join("/") || null;

  return (
    <div
      className="space-y-6"
      data-cy="devtools-tests-page"
    >
      {/* Header */}
      <AreaPageHeader icon={FileText} title={t("title")} subtitle={t("description")} />

      {/* Test Cases Viewer */}
      <TestCasesViewer initialPath={initialPath} />
    </div>
  );
}

export default function DevTestsPage({ params }: DevTestsPageProps) {
  return (
    <Suspense fallback={null}>
      <DevTestsPageContent params={params} />
    </Suspense>
  );
}
