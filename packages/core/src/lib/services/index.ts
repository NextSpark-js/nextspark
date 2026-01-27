/**
 * Services Module
 *
 * Centralized exports for all service classes.
 * Import services from this module for consistency.
 *
 * @example
 * import { UserService, MetaService, PlanService } from './'
 */

export { UserService } from './user.service'
export { MetaService } from './meta.service'
export { PlanService } from './plan.service'
export { SubscriptionService } from './subscription.service'
export { UsageService } from './usage.service'
export { InvoiceService } from './invoice.service'
export { TeamService } from './team.service'
export { TeamMemberService } from './team-member.service'
export { PermissionService } from './permission.service'
export { MembershipService, TeamMembership } from './membership.service'
export { ThemeService, getThemeAppConfig } from './theme.service'
export { EntityTypeService } from './entity-type.service'
export { NamespaceService } from './namespace.service'
export {
  MiddlewareService,
  hasThemeMiddleware,
  executeThemeMiddleware,
  addUserHeadersMiddleware
} from './middleware.service'
export { ScopeService } from './scope.service'
export { RouteHandlerService } from './route-handler.service'
export { PluginService, usePlugin } from './plugin.service'
export { ApiRoutesService } from './api-routes.service'
export {
  DocsService,
  getDocsRegistry,
  getAllDocs,
  getPublicDocs,
  getSuperadminDocs,
  findDocsSection,
  findDocsPage,
  searchDocs,
} from './docs.service'
export { GenericEntityService } from './generic-entity.service'
export { PatternUsageService } from './pattern-usage.service'
export { TransactionalMetaService } from './transactional-meta.service'

// Export types
export type { UpdateUserPayload } from './user.service'
export type { ListPlansOptions } from './plan.service'
export type { CreateSubscriptionOptions, ChangePlanResult } from './subscription.service'
export type { TrackUsageParams, UsageTimelineOptions } from './usage.service'
export type { ListInvoicesOptions, ListInvoicesResult, CreateInvoicePayload } from './invoice.service'
export type { TeamWithMemberCount, TeamWithDetails, UpdateTeamPayload } from './team.service'
export type { TeamMemberWithUser, AddMemberOptions } from './team-member.service'
export type { ThemeRegistryEntry, ThemeEntity, ThemeRouteFile, ThemeName } from './theme.service'
export type { EntityName, SearchResultType, SystemSearchType } from './entity-type.service'
export type { RouteNamespaceConfig, NamespaceConfig, RouteStrategy } from './namespace.service'
export type { MiddlewareRegistryEntry } from './middleware.service'
export type { ScopeConfig, ApiConfig, RestrictionRule } from './scope.service'
export type { RouteHandler } from './route-handler.service'
export type { PluginRegistryEntry, RouteFileEndpoint, PluginEntity, PluginName, PluginConfig, RouteMetadata } from './plugin.service'
export type { ApiRouteEntry, RouteCategory } from './api-routes.service'
export type { GenericListOptions, GenericListResult } from './generic-entity.service'
export type { PatternUsage, PatternUsageWithEntityInfo, PatternUsageCount, GetUsagesOptions, GetUsagesResult } from './pattern-usage.service'