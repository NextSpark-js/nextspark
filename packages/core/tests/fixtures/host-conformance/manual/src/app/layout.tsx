import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Shell } from '@fixture-core/components/Shell'

export const metadata: Metadata = {
  title: { default: 'Host fixture', template: '%s · Host fixture' },
  description: 'Synthetic NextSpark generated-host conformance fixture',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  )
}
