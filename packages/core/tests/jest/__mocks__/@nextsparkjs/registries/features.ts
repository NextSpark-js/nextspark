/** Features mock for tests: the flags of a project that sets none (mcpOAuth is opt-in, #541). A test changes one with jest.mock. */
export const FEATURES: { readonly billing: boolean; readonly superadmin: boolean; readonly mcpOAuth: boolean } = { billing: true, superadmin: true, mcpOAuth: false }
