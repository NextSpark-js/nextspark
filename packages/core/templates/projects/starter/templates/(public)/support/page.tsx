import { getTranslations } from 'next-intl/server'

export default async function SupportPage() {
  const t = await getTranslations('common')

  return (
    <main className="container py-12" data-cy="support-page">
      <h1 className="text-3xl font-bold">Support</h1>
      <p className="mt-4 text-muted-foreground">
        Get help with the Starter theme.
      </p>
    </main>
  )
}
