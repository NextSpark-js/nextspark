import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Home' }

export default function CoreHomePage() {
  return <h1 data-probe="core-home">Core home page</h1>
}
