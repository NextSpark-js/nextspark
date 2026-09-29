import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = { title: 'Shell (project layout)' }

// Composed inside core's shell layout: the project layout renders in what core's wrapper provides.
export default function ProjectShellLayout({ children }: { children: ReactNode }) {
  return <div data-probe="project-shell-layout">{children}</div>
}
