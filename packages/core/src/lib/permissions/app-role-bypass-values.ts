/**
 * The values of `teams.appRoleBypass` (#457), in a module with no imports: lib/config/types.ts reads the type from
 * here, and type-checking it alone must not pull in the config loader and the generated registries that
 * app-role-bypass.ts imports. The registry build keeps its own copy, which a test compares with this list.
 */
export const APP_ROLE_BYPASS_VALUES = ['none', 'developer', 'developer-and-superadmin'] as const
export type AppRoleBypass = (typeof APP_ROLE_BYPASS_VALUES)[number]
