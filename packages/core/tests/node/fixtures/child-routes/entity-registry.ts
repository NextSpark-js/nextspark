/** The project registry of the child routes test: a team-shared `customers` entity with a `notes` child entity. */
const customers = {
  slug: 'customers',
  tableName: 'customers',
  enabled: true,
  names: { singular: 'customer', plural: 'customers' },
  access: { public: false, api: true, metadata: false, shared: true },
  fields: [
    { name: 'name', type: 'text', required: true, display: { label: 'Name' }, api: { searchable: true, sortable: true, readOnly: false } },
  ],
}

const notes = {
  table: 'notes',
  showInParentView: true,
  hasOwnRoutes: false,
  display: { title: 'Notes', mode: 'list' },
  fields: [
    { name: 'body', type: 'text', required: true },
    { name: 'stars', type: 'number', required: false },
  ],
}

export const ENTITY_REGISTRY: Record<string, any> = {
  customers: { name: 'customers', config: customers, tableName: 'customers', parent: null, children: ['notes'], depth: 0, source: 'project' },
  notes: { name: 'notes', config: notes, tableName: 'customers_notes', parent: 'customers', children: [], depth: 1, source: 'project' },
}

export const ENTITY_METADATA = { totalEntities: 2, maxDepth: 1, generatedAt: '2026-10-15T00:00:00.000Z' }
