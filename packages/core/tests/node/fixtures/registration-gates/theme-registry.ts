/** The project registry of the registration gates test: its app config comes from REGISTRATION_GATES_APP_CONFIG. */
export const THEME_REGISTRY = {
  project: {
    name: 'project',
    slug: 'project',
    displayName: 'Project',
    description: '',
    version: '1.0.0',
    entities: [],
    routes: [],
    middlewares: [],
    plugins: [],
    path: '.',
    appConfig: JSON.parse(process.env.REGISTRATION_GATES_APP_CONFIG ?? '{}'),
  },
}
