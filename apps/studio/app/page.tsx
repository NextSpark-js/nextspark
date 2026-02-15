'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, ArrowRight } from 'lucide-react'

const EXAMPLES = [
  'A CRM for my gym with clients, memberships and payments',
  'Blog for my photography portfolio',
  'Project management tool for my remote team',
  'SaaS para gestionar reservas de un restaurante',
]

export default function HomePage() {
  const [prompt, setPrompt] = useState('')
  const router = useRouter()

  function handleSubmit(text?: string) {
    const input = text || prompt
    if (!input.trim()) return
    const encoded = encodeURIComponent(input.trim())
    router.push(`/build?prompt=${encoded}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-xl space-y-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-7 w-7 text-accent" />
            <h1 className="text-2xl font-bold tracking-tight">
              nextspark studio
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Describe your app. We build it.
          </p>
        </div>

        {/* Prompt Input */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit()
              }
            }}
            placeholder="Describe the app you want to build..."
            rows={3}
            className="w-full resize-none rounded-xl border border-border bg-bg-surface p-4 pr-14 text-sm text-text-primary placeholder:text-text-muted/60 focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/30 transition-colors"
            autoFocus
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!prompt.trim()}
            className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white transition-all hover:bg-accent-hover disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-[11px] text-text-muted text-center uppercase tracking-wider font-medium">
            Try an example
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => handleSubmit(example)}
                className="rounded-lg border border-border bg-bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 text-[11px] text-text-muted/50">
        Powered by NextSpark + Claude
      </div>
    </div>
  )
}
