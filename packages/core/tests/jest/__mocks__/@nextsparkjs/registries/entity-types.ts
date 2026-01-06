/**
 * Mock Entity Types Registry for Jest tests
 */

export const ENTITY_METADATA = {
  generated: new Date().toISOString(),
  totalEntities: 0,
}

export type EntityName = string

export type SearchResultType = {
  id: string
  title: string
  type: string
}

export type SystemSearchType = {
  query: string
  results: SearchResultType[]
}
