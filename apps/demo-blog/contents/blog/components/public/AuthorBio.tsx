'use client'

/**
 * Author Bio Component
 *
 * Author section with avatar, name, bio, and social links.
 */

import Image from 'next/image'
import Link from 'next/link'
import { Twitter, Github, Linkedin, Globe, User } from 'lucide-react'

interface SocialLink {
  type: 'twitter' | 'github' | 'linkedin' | 'website'
  url: string
}

interface AuthorBioProps {
  name: string
  bio?: string
  avatar?: string | null
  socialLinks?: SocialLink[]
  showMoreLink?: boolean
}

const socialIcons = {
  twitter: Twitter,
  github: Github,
  linkedin: Linkedin,
  website: Globe
}

export function AuthorBio({
  name,
  bio,
  avatar,
  socialLinks = [],
  showMoreLink = true
}: AuthorBioProps) {
  return (
    <div data-cy="author-bio" className="flex items-start gap-4 p-6 bg-muted/30 rounded-xl border border-border">
      {/* Avatar */}
      <div data-cy="author-bio-avatar" className="flex-shrink-0">
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            width={64}
            height={64}
            className="rounded-full"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div data-cy="author-bio-content" className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <h3 data-cy="author-bio-name" className="font-semibold text-foreground">{name}</h3>
          {showMoreLink && (
            <Link
              href="/about"
              data-cy="author-bio-more-link"
              className="text-sm text-primary hover:underline"
            >
              More articles
            </Link>
          )}
        </div>

        {bio && (
          <p data-cy="author-bio-text" className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {bio}
          </p>
        )}

        {socialLinks.length > 0 && (
          <div data-cy="author-bio-social-links" className="flex gap-2">
            {socialLinks.map((link) => {
              const Icon = socialIcons[link.type]
              return (
                <a
                  key={link.type}
                  href={link.url}
                  data-cy={`author-bio-social-${link.type}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                  aria-label={link.type}
                >
                  <Icon className="w-4 h-4" />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AuthorBio
