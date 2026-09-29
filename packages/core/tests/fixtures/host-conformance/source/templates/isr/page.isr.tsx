import type { Metadata } from 'next'

export const revalidate = 60

export const metadata: Metadata = { title: 'ISR' }

export default async function IsrPage() {
  return <p data-probe="isr">Rendered at {new Date().toISOString()}</p>
}
