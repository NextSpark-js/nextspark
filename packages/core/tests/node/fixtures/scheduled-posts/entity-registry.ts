/** The project registry of the scheduled posts test: a public `posts` entity with a status and a publishing date. */
const posts = {
  slug: 'posts',
  tableName: 'posts',
  enabled: true,
  names: { singular: 'post', plural: 'posts' },
  access: { public: true, api: true, metadata: false, shared: false },
  fields: [
    { name: 'title', type: 'text', required: true, display: { label: 'Title' }, api: { searchable: true, sortable: true, readOnly: false } },
    { name: 'status', type: 'select', required: true, options: [{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }], display: { label: 'Status' }, api: { sortable: true, readOnly: false } },
    { name: 'publishedAt', type: 'datetime', required: false, display: { label: 'Published at' }, api: { sortable: true, readOnly: false } },
    { name: 'hashtags', type: 'json', required: false, display: { label: 'Hashtags' }, api: { readOnly: false } },
  ],
}

export const ENTITY_REGISTRY: Record<string, any> = {
  posts: { name: 'posts', config: posts, tableName: 'posts', parent: null, children: [], depth: 0, source: 'project' },
}

export const ENTITY_METADATA = { totalEntities: 1, maxDepth: 0, generatedAt: '2026-11-21T00:00:00.000Z' }
