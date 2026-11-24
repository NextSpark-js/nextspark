import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OAuthTeamSelect } from '@nextsparkjs/core/components/auth/OAuthTeamSelect'
import { isMcpOAuthEnabled } from '@nextsparkjs/core/lib/mcp/oauth/config'
import { authPageMetadata } from '@nextsparkjs/core/routes/_internal/auth-metadata'

export const dynamic = 'force-dynamic'

/** Not a page while MCP_OAUTH_ENABLED is off (the proxy answers the 404, see ../consent/page). */
export async function generateMetadata(): Promise<Metadata> {
  if (!isMcpOAuthEnabled()) notFound()
  return { ...(await authPageMetadata('login.title', 'login.description')), robots: { index: false } }
}

/** The team picker of an MCP browser sign-in (#541): a user in several teams chooses the one to connect. */
export default function OAuthSelectTeamPage() {
  if (!isMcpOAuthEnabled()) notFound()
  return <OAuthTeamSelect />
}
