import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NextSpark Studio',
  description: 'Describe your app. We build it.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg antialiased">
        {children}
      </body>
    </html>
  )
}
