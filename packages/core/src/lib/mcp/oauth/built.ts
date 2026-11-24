/**
 * Whether the project was built with MCP browser sign-in (`features.mcpOAuth`), #541.
 *
 * On its own, with nothing but the generated flags behind it, because client code asks it: the auth client and
 * `useAuth` are in the JavaScript of every page, the public ones included. `./config` reads the app configuration
 * (the list of accepted applications, the URLs), and importing this from there put that module, with the
 * dashboard's settings helpers, in the chunks of the signed-out routes. Client code imports this file; server code
 * may use either.
 */
import { FEATURES } from '@nextsparkjs/registries/features'

export function isMcpOAuthBuilt(): boolean {
  return FEATURES.mcpOAuth === true
}
