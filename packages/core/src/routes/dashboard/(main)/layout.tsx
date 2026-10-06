/**
 * Main Dashboard Layout with Permission Checking
 *
 * This layout handles:
 * 1. Entity registry initialization
 * 2. Server-side permission validation for entity routes
 * 3. Rendering the DashboardShell with entity navigation
 *
 * The permission check of each entity's routes is its own generated layout (entity-permission-layout), because
 * the generated host writes one concrete route per entity.
 */
import { MainDashboardShell, enforceEntityPermission } from '../../_internal/dashboard-main-shared'

// Default main dashboard layout component with permission checking
async function DefaultMainDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  await enforceEntityPermission()

  return <MainDashboardShell>{children}</MainDashboardShell>
}

// Export the resolved component (theme override or default)
export default DefaultMainDashboardLayout
