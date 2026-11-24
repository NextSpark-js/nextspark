/**
 * The height /login holds while it checks which sign-in methods are available (#557). The card shown meanwhile is
 * about 170 px; the form that replaces it is 230 to 800 px, and the page is centered, so everything moved when it
 * arrived. The page wraps the form in a box with the height of the form the project is expected to show; the `.lr`
 * rule of `styles/utilities.css` gives it that height only while the loading card is there, so a form of another
 * height is never padded.
 *
 * It is decided on the server from static config (the login methods, registration mode, demo mode and the number of
 * sample accounts), so it adds no JavaScript. Heights are those of the ready form measured at 360 px (`mobile`) and
 * from 640 px (`sm`).
 * ponytail: a project with other method combinations (magic link, several social providers) keeps the unreserved card.
 */

/** Ready form height in px: [mobile, sm and up], by the sorted list of methods, with the link to sign up */
const BY_METHODS: Record<string, [number, number]> = {
  'email-otp': [272, 256],
  'email-password': [426, 426],
  'email-otp,google': [230, 230],
  'email-otp,email-password': [376, 360],
  // The starter's own examples, which sit commented in its app.config.ts: the password form with Google
  'email-password,google': [274, 274],
  'email-otp,email-password,google': [274, 274],
}

/** The "no account yet" link of a password form, which only registration that anyone can use shows */
const SIGNUP_LINK = 44

export interface LoginReserveInput {
  demo: boolean
  /** Sample accounts of the demo (`devKeyring.users`) */
  accounts: number
  methods: readonly string[]
  /** `auth.registration.mode` */
  registration: string
}

export function loginReserve({ demo, accounts, methods, registration }: LoginReserveInput) {
  let heights: number[] | undefined
  if (demo) {
    // The demo signs in with a password and lists every account; the rest of the form does not change
    heights = [542 + 64 * accounts, 456 + 74 * accounts]
  } else if (registration !== 'domain-restricted') {
    // domain-restricted without a demo shows a small card with no email sign-in (122 px): not reserved
    heights = BY_METHODS[[...methods].sort().join(',')]
    if (heights && methods.includes('email-password') && registration !== 'open' && registration !== 'domain-open') {
      heights = heights.map(h => h - SIGNUP_LINK)
    }
  }
  if (!heights) return null
  const [mobile, sm] = heights
  // --r-sm is left out when it is the same: the rule falls back to --r
  return { className: 'lr', style: (sm === mobile ? { '--r': `${mobile}px` } : { '--r': `${mobile}px`, '--r-sm': `${sm}px` }) as Record<string, string> }
}
