import { Shield } from "lucide-react";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { sel } from "@nextsparkjs/core/lib/selectors"
import { BusinessMetrics } from "@nextsparkjs/core/components/superadmin/misc/BusinessMetrics"

/**
 * Superadmin Dashboard
 *
 * The platform's business metrics. The sections of the area are in the sidebar, so the page does not repeat them.
 */
function SuperadminDashboard() {
  const t = useTranslations("superadmin.dashboard");

  return (
    <div className="space-y-6" data-cy={sel('superadmin.dashboard.container')}>
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 bg-red-100 rounded-lg">
            <Shield className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("panelTitle")}</h1>
            <p className="text-muted-foreground">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
          <Shield className="h-4 w-4 text-destructive" />
          <span className="text-destructive font-medium">
            {t("restrictedAccess")}
          </span>
        </div>
      </div>

      <Suspense fallback={<div className="h-40 rounded-lg border bg-muted/30 animate-pulse" />}>
        <BusinessMetrics />
      </Suspense>
    </div>
  );
}

export default SuperadminDashboard