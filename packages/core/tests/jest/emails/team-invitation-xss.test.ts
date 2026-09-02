/**
 * Regression test for GHSA-66jx-f27r-q2fh.
 *
 * teamName/inviterName/inviteeEmail are attacker-controllable (a team's name
 * has no character restriction beyond a length CHECK; inviterName traces back
 * to the inviter's own display name) and render in the INVITEE's inbox — a
 * different person than whoever chose the value. Unescaped, that's a stored
 * HTML injection with a distinct victim, not self-XSS.
 */
import teamInvitation from '../../../src/emails/team-invitation'

const XSS_PAYLOAD = '<img src=x onerror=alert(document.domain)>'
const ESCAPED_PAYLOAD = '&lt;img src=x onerror=alert(document.domain)&gt;'

describe('GHSA-66jx-f27r-q2fh — team-invitation email HTML escaping', () => {
  it('escapes an XSS payload in teamName and inviterName in the HTML body', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'victim@example.com',
        inviterName: XSS_PAYLOAD,
        teamName: XSS_PAYLOAD,
        role: 'member',
        acceptUrl: 'https://example.com/accept-invite/tok',
        expiresIn: '7 days',
        appName: 'NextSpark',
      },
      'en',
    )

    expect(result.html).not.toContain(XSS_PAYLOAD)
    expect(result.html).toContain(ESCAPED_PAYLOAD)
  })

  it('escapes an XSS payload in inviteeEmail in the HTML body', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: `"><img src=x onerror=alert(1)>@example.com`,
        inviterName: 'Alex Alpha',
        teamName: 'Alpha Tech',
        role: 'member',
        acceptUrl: 'https://example.com/accept-invite/tok',
        expiresIn: '7 days',
        appName: 'NextSpark',
      },
      'en',
    )

    expect(result.html).not.toMatch(/<img src=x onerror=alert\(1\)>/)
    expect(result.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('does not double-escape a plain, non-malicious name', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'victim@example.com',
        inviterName: "O'Brien & Associates",
        teamName: 'Alpha Tech',
        role: 'member',
        acceptUrl: 'https://example.com/accept-invite/tok',
        expiresIn: '7 days',
        appName: 'NextSpark',
      },
      'en',
    )

    expect(result.html).toContain('O&#39;Brien &amp; Associates')
  })

  it('leaves the subject line un-escaped (it is a mail header, not HTML)', async () => {
    const result = await teamInvitation(
      {
        inviteeEmail: 'victim@example.com',
        inviterName: 'Alex Alpha',
        teamName: "O'Brien & Co",
        role: 'member',
        acceptUrl: 'https://example.com/accept-invite/tok',
        expiresIn: '7 days',
        appName: 'NextSpark',
      },
      'en',
    )

    expect(result.subject).toContain("O'Brien & Co")
    expect(result.subject).not.toContain('&#39;')
    expect(result.subject).not.toContain('&amp;')
  })
})
