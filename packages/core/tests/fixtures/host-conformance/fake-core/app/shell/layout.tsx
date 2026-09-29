import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { withShell } from '../shell-layout'

export const metadata: Metadata = { title: 'Shell (core default)' }

function CoreShellLayout({ children }: { children: ReactNode }) {
  return <div data-probe="core-shell-inner">{children}</div>
}

export default withShell(CoreShellLayout)
