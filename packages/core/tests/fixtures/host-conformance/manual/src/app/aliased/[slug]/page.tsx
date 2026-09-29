import { notFound } from 'next/navigation'

const SLUGS = ['one', 'two']

// generateStaticParams exported under an alias: Next's static analysis reads the
// local name (`listSlugs`), so the facade must forward it the same way.
async function listSlugs() {
  return SLUGS.map(slug => ({ slug }))
}
export { listSlugs as generateStaticParams }

export default async function AliasedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUGS.includes(slug)) notFound()
  return <p data-probe={`aliased-${slug}`}>Aliased {slug}</p>
}
