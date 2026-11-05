import { generateMetadata, withAuthMessages } from '../_internal/auth-layout'
import { DefaultAuthLayout } from '../_internal/default-auth-layout'

export { generateMetadata }

export default withAuthMessages(DefaultAuthLayout)
