/** The features registry of the auth driver: a project that sets none, with MCP browser sign-in (#541) when the run asks for it. */
export const FEATURES = { billing: true, superadmin: true, mcpOAuth: process.env.MCP_OAUTH_ENABLED === 'true' }
