/**
 * Blog Public Layout
 *
 * Clean, minimal layout for the public-facing blog.
 * Uses custom BlogNavbar and BlogFooter components.
 *
 * A server component: the navbar and the footer are client components of their own, and the copyright year is read on
 * the server (cached), so the layout renders into the prerendered HTML of every public page (#493).
 */

import { BlogNavbar } from '@/components/public/BlogNavbar'
import { BlogFooter } from '@/components/public/BlogFooter'
import { CopyrightYear } from '@/components/public/CopyrightYear'

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
        year={<CopyrightYear />}
      />
    </div>
  )
}
