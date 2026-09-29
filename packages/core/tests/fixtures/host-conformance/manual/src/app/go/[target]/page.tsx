import { redirect } from 'next/navigation'

export default async function GoPage({ params }: { params: Promise<{ target: string }> }) {
  const { target } = await params
  redirect(`/posts/${encodeURIComponent(target)}`)
}
