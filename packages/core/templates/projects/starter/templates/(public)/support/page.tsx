import { pageMetadata } from '@nextsparkjs/core/lib/seo/page-metadata'

export const metadata = pageMetadata({
  title: 'Support',
  description: 'Get help with the Starter theme.',
  path: '/support',
})

export default function SupportPage() {
  return (
    <div className="container py-12" data-cy="support-page">
      <h1 className="text-3xl font-bold">Support</h1>
      <p className="mt-4 text-muted-foreground">
        Get help with the Starter theme.
      </p>
    </div>
  )
}
