import type { ComponentType, ReactNode } from 'react'
import RootLayout from '../layout'

/**
 * Core's root layout (providers, protections) around a project's `templates/layout.tsx`.
 *
 * The generated host composes a project root layout with this wrapper instead of replacing
 * core's layout: the project's layout renders inside the providers, so it can never drop them.
 */
export function withRootLayout(ProjectLayout: ComponentType<{ children: ReactNode }>) {
  return function RootLayoutWithProjectLayout({ children }: { children: ReactNode }) {
    return (
      <RootLayout>
        <ProjectLayout>{children}</ProjectLayout>
      </RootLayout>
    )
  }
}
