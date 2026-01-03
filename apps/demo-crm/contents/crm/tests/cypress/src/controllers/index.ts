/**
 * CRM API Controllers Index
 *
 * Exports all TypeScript API controllers for CRM entities
 */

export { BaseAPIController } from './BaseAPIController'
export type { APIRequestOptions, APIResponse, CreateTestRecordOptions } from './BaseAPIController'

export { ActivityAPIController } from './ActivityAPIController'
export type { ActivityData, ActivityGetAllOptions } from './ActivityAPIController'

export { LeadAPIController } from './LeadAPIController'
export type { LeadData, LeadGetAllOptions } from './LeadAPIController'

export { ProductAPIController } from './ProductAPIController'
export type { ProductData, ProductGetAllOptions } from './ProductAPIController'

export { PipelineAPIController } from './PipelineAPIController'
export type { PipelineData, PipelineStage, PipelineGetAllOptions } from './PipelineAPIController'

export { ContactAPIController } from './ContactAPIController'
export type { ContactData, ContactGetAllOptions } from './ContactAPIController'

export { CampaignAPIController } from './CampaignAPIController'
export type { CampaignData, CampaignGetAllOptions } from './CampaignAPIController'

export { CompanyAPIController } from './CompanyAPIController'
export type { CompanyData, CompanyGetAllOptions } from './CompanyAPIController'

export { OpportunityAPIController } from './OpportunityAPIController'
export type { OpportunityData, OpportunityGetAllOptions } from './OpportunityAPIController'

export { NoteAPIController } from './NoteAPIController'
export type { NoteData, NoteGetAllOptions } from './NoteAPIController'
