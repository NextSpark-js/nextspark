/**
 * CRM Theme - Entity POMs
 *
 * Export all entity-specific Page Object Models for CRM theme testing.
 * Each POM combines generic components (EntityList, EntityForm, EntityDetail)
 * with entity-specific functionality.
 */

export { PipelinesPOM } from './PipelinesPOM'
export { OpportunitiesPOM } from './OpportunitiesPOM'
export { LeadsPOM } from './LeadsPOM'
export { ContactsPOM } from './ContactsPOM'
export { CompaniesPOM } from './CompaniesPOM'
export { ActivitiesPOM } from './ActivitiesPOM'

// Default exports for convenience
import { PipelinesPOM } from './PipelinesPOM'
import { OpportunitiesPOM } from './OpportunitiesPOM'
import { LeadsPOM } from './LeadsPOM'
import { ContactsPOM } from './ContactsPOM'
import { CompaniesPOM } from './CompaniesPOM'
import { ActivitiesPOM } from './ActivitiesPOM'

export default {
  PipelinesPOM,
  OpportunitiesPOM,
  LeadsPOM,
  ContactsPOM,
  CompaniesPOM,
  ActivitiesPOM,
}
