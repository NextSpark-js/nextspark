import { AuthenticatedDashboardLayout } from '@nextsparkjs/core/components/dashboard/layouts/AuthenticatedDashboardLayout'
import { withDashboardMessages } from '../_internal/group-layouts.cc'

/** The Cache Components dashboard layout: see ../_internal/group-layouts.cc for how its messages load. */
export default withDashboardMessages(AuthenticatedDashboardLayout)
