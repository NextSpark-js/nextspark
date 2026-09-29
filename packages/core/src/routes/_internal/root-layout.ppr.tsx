import type { ComponentType, ReactNode } from 'react'
import RootLayout from '../layout.ppr'

/**
 * `withRootLayout` for a host with `cacheComponents` on: the same composition over the PPR
 * root layout (see ../layout.ppr).
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
