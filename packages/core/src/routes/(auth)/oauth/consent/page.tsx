import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { OAuthConsent } from '@nextsparkjs/core/components/auth/OAuthConsent'
import { authPageMetadata } from '@nextsparkjs/core/routes/_internal/auth-metadata'
import { isMcpOAuthEnabled } from '@nextsparkjs/core/lib/mcp/oauth/config'

export const dynamic = 'force-dynamic'

/**
 * Not a page while MCP_OAUTH_ENABLED is off. Refused here, before the response starts, so the status is a real 404
 * (a `notFound()` in the page body arrives after the layout has begun streaming a 200).
 */
export async function generateMetadata(): Promise<Metadata> {
  if (!isMcpOAuthEnabled()) notFound()
  return { ...(await authPageMetadata('login.title', 'login.description')), robots: { index: false } }
}

/** The consent screen of an MCP browser sign-in (#541). */
export default function OAuthConsentPage() {
  if (!isMcpOAuthEnabled()) notFound()
  return <OAuthConsent />
}
