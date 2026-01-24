import { TestCasesViewer } from "@nextsparkjs/core/components/devtools";
import { FileText } from "lucide-react";
import { getTranslations } from "next-intl/server";

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
export default async function DevTestsPage({ params }: DevTestsPageProps) {
  const { path } = await params;
  const t = await getTranslations("devtools.tests");

  // Convert path array to string (e.g., ['auth', 'login.bdd.md'] -> 'auth/login.bdd.md')
  const initialPath = path?.join("/") || null;

  return (
    <div
      className="space-y-6 2xl:w-[calc(100%+500px)] 2xl:-ml-[250px]"
      data-cy="devtools-tests-page"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-12 h-12 bg-violet-100 dark:bg-violet-950 rounded-lg">
          <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Test Cases Viewer */}
      <TestCasesViewer initialPath={initialPath} />
    </div>
  );
}
