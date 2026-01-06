/**
 * Mock Entity Registry Client for Jest tests
 */

export const clientMetaSystemAdapter = {
  getEntityMeta: (name: string) => null,
  getAllEntities: () => [],
}
