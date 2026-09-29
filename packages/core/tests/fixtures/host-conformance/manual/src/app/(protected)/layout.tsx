import { Suspense, type ReactNode } from 'react'

// Composes UI only: authorization lives in data access (lib/notes-data.ts), not here.
export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <section data-probe="protected-layout">
      <h2>Protected area</h2>
      <Suspense fallback={<p>Loading…</p>}>{children}</Suspense>
    </section>
  )
}
