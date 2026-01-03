'use client'

import Link from 'next/link'
import { Button } from '@/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card'
import { Badge } from '@/core/components/ui/badge'

import { useAuth } from '@/core/hooks/useAuth'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Zap, Lock, Layers } from 'lucide-react'

/**
 * Home Page Template
 *
 * This is the main landing page for your application.
 * Customize the content, features list, and calls to action.
 */
function Home() {
  const { user, isLoading } = useAuth()
  const t = useTranslations('home')

  const features = [
    { name: t('features.protectedRoutes'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.emailVerification'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.entityManagement'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.themeSupport'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.i18nSystem'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.colorMode'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container max-w-7xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            {t('hero.badge')}
          </Badge>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-4">
            {t('hero.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('hero.description')}
          </p>
        </div>

        {/* Auth Section */}
        {!isLoading && (
          <Card className="mb-12 border-2">
            <CardContent className="p-8">
              {user ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium">{t('auth.authenticated')}</span>
                  </div>
                  <p className="text-lg">
                    {t('auth.welcomeBack', { email: user.email })}
                  </p>
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-2">
                      <Layers className="w-4 h-4" />
                      {t('auth.goToDashboard')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <h2 className="text-2xl font-semibold">{t('auth.getStarted')}</h2>
                  <p className="text-muted-foreground">
                    {t('auth.experience')}
                  </p>
                  <div className="flex justify-center gap-4">
                    <Link href="/signup">
                      <Button size="lg" className="gap-2">
                        <Zap className="w-4 h-4" />
                        {t('auth.createAccount')}
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button size="lg" variant="outline" className="gap-2">
                        <Lock className="w-4 h-4" />
                        {t('auth.signIn')}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {t('features.title')}
            </CardTitle>
            <CardDescription>
              {t('features.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  {feature.icon}
                  <span className="text-sm font-medium">{feature.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>{t('footer.builtWith')}</p>
        </div>
      </div>
    </div>
  )
}

export default Home
