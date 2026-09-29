import Link from 'next/link'
import type { ReactNode } from 'react'
import './shell.css'

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div data-probe="core-shell">
      <nav>
        <Link href="/">Home</Link> <Link href="/about">About</Link> <Link href="/posts/hello">Post</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
