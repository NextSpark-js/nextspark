'use client'

/**
 * Blog Footer Component
 *
 * Simple, clean footer with copyright, social links, and attribution.
 */

import Link from 'next/link'
import { Github, Twitter, Linkedin, Mail, Heart } from 'lucide-react'

interface SocialLink {
  name: string
  href: string
  icon: 'github' | 'twitter' | 'linkedin' | 'email'
}

interface BlogFooterProps {
  blogTitle?: string
  authorName?: string
  socialLinks?: SocialLink[]
  showNewsletter?: boolean
}

const iconMap = {
  github: Github,
  twitter: Twitter,
  linkedin: Linkedin,
  email: Mail
}

export function BlogFooter({
  blogTitle = 'My Blog',
  authorName = 'Author',
  socialLinks = [],
  showNewsletter = false
}: BlogFooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer data-cy="blog-footer" className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div data-cy="blog-footer-sections" className="grid gap-8 md:grid-cols-3">
          {/* About Section */}
          <div data-cy="blog-footer-about">
            <h3 data-cy="blog-footer-title" className="font-serif text-lg font-bold mb-3">{blogTitle}</h3>
            <p data-cy="blog-footer-description" className="text-sm text-muted-foreground leading-relaxed">
              Thoughts, stories, and ideas about technology, life, and everything in between.
            </p>
          </div>

          {/* Quick Links */}
          <div data-cy="blog-footer-quick-links">
            <h4 className="font-semibold text-sm uppercase tracking-wider mb-3 text-muted-foreground">
              Quick Links
            </h4>
            <nav data-cy="blog-footer-nav" className="flex flex-col gap-2">
              <Link
                href="/"
                data-cy="blog-footer-link-home"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/posts"
                data-cy="blog-footer-link-posts"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                All Posts
              </Link>
              <Link
                href="/dashboard"
                data-cy="blog-footer-link-dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
            </nav>
          </div>

          {/* Newsletter or Social */}
          <div data-cy="blog-footer-connect">
            {showNewsletter ? (
              <>
                <h4 className="font-semibold text-sm uppercase tracking-wider mb-3 text-muted-foreground">
                  Stay Updated
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Subscribe to get notified about new posts.
                </p>
                <form data-cy="blog-footer-newsletter-form" className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="email"
                    data-cy="blog-footer-newsletter-input"
                    placeholder="your@email.com"
                    className="flex-1 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="submit"
                    data-cy="blog-footer-newsletter-submit"
                    className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Subscribe
                  </button>
                </form>
              </>
            ) : (
              <>
                <h4 className="font-semibold text-sm uppercase tracking-wider mb-3 text-muted-foreground">
                  Connect
                </h4>
                {socialLinks.length > 0 ? (
                  <div data-cy="blog-footer-social-links" className="flex gap-3">
                    {socialLinks.map((link) => {
                      const Icon = iconMap[link.icon]
                      return (
                        <a
                          key={link.name}
                          href={link.href}
                          data-cy={`blog-footer-social-${link.icon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                          aria-label={link.name}
                        >
                          <Icon className="h-5 w-5" />
                        </a>
                      )
                    })}
                  </div>
                ) : (
                  <div data-cy="blog-footer-social-links" className="flex gap-3">
                    <a
                      href="https://twitter.com"
                      data-cy="blog-footer-social-twitter"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      aria-label="Twitter"
                    >
                      <Twitter className="h-5 w-5" />
                    </a>
                    <a
                      href="https://github.com"
                      data-cy="blog-footer-social-github"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      aria-label="GitHub"
                    >
                      <Github className="h-5 w-5" />
                    </a>
                    <a
                      href="https://linkedin.com"
                      data-cy="blog-footer-social-linkedin"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      aria-label="LinkedIn"
                    >
                      <Linkedin className="h-5 w-5" />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Bar */}
        <div data-cy="blog-footer-bottom" className="mt-12 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p data-cy="blog-footer-copyright" className="text-sm text-muted-foreground">
            &copy; {currentYear} {blogTitle}. All rights reserved.
          </p>
          <p data-cy="blog-footer-attribution" className="text-sm text-muted-foreground flex items-center gap-1">
            Made with <Heart className="h-3 w-3 text-destructive fill-destructive" /> by {authorName}
          </p>
        </div>
      </div>
    </footer>
  )
}

export default BlogFooter
