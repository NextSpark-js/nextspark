import type { ComponentType, ReactNode } from 'react'
import RootLayout from '../layout.ppr'

/**
 * `withRootLayout` for a host with `cacheComponents` on: the same composition over the PPR
 * root layout (see ../layout.ppr).
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
