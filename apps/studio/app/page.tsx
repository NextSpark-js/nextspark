'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, ArrowRight } from 'lucide-react'

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
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-accent" />
            <h1 className="text-3xl font-bold tracking-tight">
              NextSpark Studio
            </h1>
          </div>
          <p className="text-text-secondary text-lg">
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
            rows={4}
            className="w-full resize-none rounded-xl border border-border bg-bg-surface p-4 pr-14 text-lg text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            autoFocus
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!prompt.trim()}
            className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Examples */}
        <div className="space-y-3">
          <p className="text-sm text-text-muted text-center">Try an example</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                onClick={() => handleSubmit(example)}
                className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:bg-bg-elevated hover:text-text-primary"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-6 text-sm text-text-muted">
        Powered by NextSpark + Claude
      </div>
    </div>
  )
}
