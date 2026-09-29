import { notFound } from 'next/navigation'

const ITEMS: Record<string, string> = { '1': 'Item one', '2': 'Item two' }

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!Object.hasOwn(ITEMS, id)) notFound()
  return <p data-probe={`item-${id}`}>{ITEMS[id]}</p>
}
