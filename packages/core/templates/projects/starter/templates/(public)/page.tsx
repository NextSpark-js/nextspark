import { Suspense } from 'react'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { SkeletonLandingPage } from '@nextsparkjs/core/components/ui/skeleton-public'

// The skeleton is scoped to the home page. A loading.tsx in this route group would wrap every public route, the
// catch-all that ends in notFound() included, and Next answers 200 for a not-found that renders behind a boundary
export default function HomePage() {
  return (
    <Suspense fallback={<SkeletonLandingPage />}>
      <HomeContent />
    </Suspense>
  )
}

async function HomeContent() {
  const t = await getTranslations('home')

  return (
    <main className="flex min-h-screen flex-col" data-cy="home-page">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          {t('hero.title')}
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
          {t('hero.subtitle')}
        </p>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link href="/dashboard">{t('hero.cta')}</Link>
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-24 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center">{t('features.title')}</h2>
          <p className="mt-4 text-center text-muted-foreground">
            {t('features.subtitle')}
          </p>
          {/* Feature cards would go here */}
        </div>
      </section>
    </main>
  )
}
