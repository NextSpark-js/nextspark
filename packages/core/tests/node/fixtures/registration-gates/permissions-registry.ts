/** Jest's permissions registry stand-in, with the exports it leaves out that the auth routes' module graph imports. */
export * from '../../../jest/__mocks__/@nextsparkjs/registries/permissions-registry'
export const ALL_RESOLVED_PERMISSIONS: unknown[] = []
export const PERMISSIONS_BY_CATEGORY: Record<string, unknown[]> = {}
export const FULL_MATRIX: Record<string, unknown> = {}
export const UI_SECTIONS: unknown[] = []
export const PERMISSIONS_METADATA: any = {}
