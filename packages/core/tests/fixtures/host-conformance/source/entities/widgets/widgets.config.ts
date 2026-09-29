// The fixture's entity config: what the host reads as literals to write the entity's routes.
export const widgetsEntityConfig = {
  slug: 'widgets',
  enabled: true,
  names: { singular: 'widget', plural: 'Widgets' },
  ui: { dashboard: { showInMenu: true } },
} as const
