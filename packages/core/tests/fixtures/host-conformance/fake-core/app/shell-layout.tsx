import type { ComponentType, ReactNode } from 'react'

/**
 * What core's group layouts wrap whatever layout the host resolves in (`withPublicMessages` and its siblings
 * in the real core): a project override of the layout is composed with it, never a replacement.
 */
export function withShell(Layout: ComponentType<{ children: ReactNode }>) {
  return function ShellLayout({ children }: { children: ReactNode }) {
    return (
      <section data-probe="core-shell-layout">
        <Layout>{children}</Layout>
      </section>
    )
  }
}
