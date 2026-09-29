import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About (core default)' }

export default function CoreAboutPage() {
  return <h1 data-probe="core-about">Core default about page</h1>
}
