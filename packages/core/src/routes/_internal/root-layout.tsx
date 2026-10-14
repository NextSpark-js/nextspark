import type { ComponentType, ReactNode } from 'react'
import RootLayout from '../layout'

/**
 * Core's root layout (providers, protections) around a project's `templates/layout.tsx`.
 *
 * The generated host composes a project root layout with this wrapper instead of replacing
 * core's layout: the project's layout renders inside the providers, so it can never drop them.
 */
export function withRootLayout<P extends { children: ReactNode }>(ProjectLayout: ComponentType<P>) {
  // Every prop goes to the project's layout: `children`, and the parallel route slots (`@modal` -> `modal`) it declares
  return function RootLayoutWithProjectLayout(props: P) {
    return (
      <RootLayout>
        <ProjectLayout {...props} />
      </RootLayout>
    )
  }
}
