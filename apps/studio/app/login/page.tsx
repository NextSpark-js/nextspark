'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Zap, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/auth-client'
import Link from 'next/link'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await signIn.email({
      email,
      password,
    })

    if (authError) {
      setError(authError.message || 'Invalid credentials')
      setLoading(false)
      return
    }

    router.push(callbackUrl)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-sm space-y-8 animate-card-in">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <div className="absolute -inset-3 rounded-full bg-accent/20 blur-lg" />
              <Zap className="relative h-7 w-7 text-accent" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">
              nextspark studio
            </h1>
          </div>
          <p className="text-text-secondary text-sm">Sign in to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-medium text-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-medium text-text-secondary">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <p className="text-xs text-error bg-error/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent-hover hover:shadow-lg hover:shadow-accent/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </button>
        </form>

        <p className="text-center text-xs text-text-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-accent hover:text-accent-hover transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
