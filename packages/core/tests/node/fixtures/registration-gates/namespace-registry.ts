/** Jest's namespace registry stand-in, with the export it leaves out that the auth routes' module graph imports. */
export * from '../../../jest/__mocks__/@nextsparkjs/registries/namespace-registry'
export const NAMESPACE_CONFIG = { core: [] as string[], entities: [] as string[], routes: {} as Record<string, string[]>, entityPaths: {} as Record<string, string> }
