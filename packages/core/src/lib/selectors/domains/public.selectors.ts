/**
 * Public Selectors
 *
 * Selectors for public-facing pages:
 * - Navbar
 * - Footer
 * - Public pages
 * - Blog
 */

export const PUBLIC_SELECTORS = {
  navbar: {
    container: 'public-navbar',
    logo: 'navbar-logo',
    loginButton: 'navbar-login',
    signupButton: 'navbar-signup',
  },
  footer: {
    container: 'public-footer',
    logo: 'footer-logo',
  },
  page: {
    container: 'public-page-{slug}',
    title: 'page-title',
    content: 'page-content',
  },
  blog: {
    listContainer: 'blog-list',
    postCard: 'blog-post-{slug}',
  },
} as const

export type PublicSelectorsType = typeof PUBLIC_SELECTORS
