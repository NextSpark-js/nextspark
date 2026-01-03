'use client'

/**
 * Blog Public Layout
 *
 * Clean, minimal layout for the public-facing blog.
 * Uses custom BlogNavbar and BlogFooter components.
 */

import { BlogNavbar } from '@/themes/blog/components/public/BlogNavbar'
import { BlogFooter } from '@/themes/blog/components/public/BlogFooter'

interface BlogLayoutProps {
  children: React.ReactNode
}

// Navigation links for the public blog
const NAV_LINKS = [
  { name: 'Authors', href: '/authors' }
]

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navigation */}
      <BlogNavbar
        blogTitle="My Blog"
        navLinks={NAV_LINKS}
      />

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <BlogFooter
        blogTitle="My Blog"
        authorName="Your Name"
        showNewsletter={false}
      />
    </div>
  )
}
