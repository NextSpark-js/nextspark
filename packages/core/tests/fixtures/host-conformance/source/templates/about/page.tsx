import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'About' }

export default function ProjectAboutPage() {
  return <h1 data-probe="project-about">Project about page (overrides core)</h1>
}
