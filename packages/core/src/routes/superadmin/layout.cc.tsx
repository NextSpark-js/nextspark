import { ServerCheckedSuperadminLayout, generateMetadata } from '../_internal/superadmin-layout'
import { withSuperadminAreaMessages } from '../_internal/superadmin-layout.cc'

export { generateMetadata }

export default withSuperadminAreaMessages(ServerCheckedSuperadminLayout)
