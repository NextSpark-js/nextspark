'use client'

/**
 * Authors List Page
 *
 * Public page listing all blog authors with their profile info.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { User } from 'lucide-react'

interface Author {
  id: string
  name: string
  username: string
  bio: string | null
  image: string | null
  postCount: number
}

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAuthors = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/v1/theme/blog/authors', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to load authors')
        }

        const result = await response.json()
        setAuthors(result.data || [])
      } catch (err) {
        console.error('Error fetching authors:', err)
        setError(err instanceof Error ? err.message : 'Unable to load authors')
      } finally {
        setLoading(false)
      }
    }

    fetchAuthors()
  }, [])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading authors...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-2">Error Loading Authors</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <section className="py-12 border-b border-border">
        <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">
          Our Authors
        </h1>
        <p className="text-lg text-muted-foreground">
          Meet the writers who share their stories, ideas, and expertise on our platform.
        </p>
      </section>

      {/* Authors Grid */}
      <section className="py-12">
        {authors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No authors found.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {authors.map((author) => (
              <Link
                key={author.id}
                href={`/author/${author.username}`}
                className="group block p-6 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-lg transition-all"
              >
                {/* Avatar */}
                <div className="flex justify-center mb-4">
                  {author.image ? (
                    <Image
                      src={author.image}
                      alt={author.name}
                      width={80}
                      height={80}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <User className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="text-center">
                  <h2 className="font-serif text-xl font-bold group-hover:text-primary transition-colors">
                    {author.name}
                  </h2>
                  <p className="text-sm text-muted-foreground mb-3">
                    @{author.username}
                  </p>

                  {author.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {author.bio}
                    </p>
                  )}

                  {/* Post Count */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-xs">
                    <span className="font-semibold">{author.postCount}</span>
                    <span className="text-muted-foreground">
                      {author.postCount === 1 ? 'post' : 'posts'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
