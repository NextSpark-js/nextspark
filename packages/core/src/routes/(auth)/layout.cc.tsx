import { generateMetadata } from '../_internal/auth-layout'
import { DefaultAuthLayout } from '../_internal/default-auth-layout'
import { withAuthMessages } from '../_internal/auth-layout.cc'

export { generateMetadata }

export default withAuthMessages(DefaultAuthLayout)
