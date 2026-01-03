'use client'

import Link from 'next/link'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'

import { useAuth } from '@nextsparkjs/core/hooks/useAuth'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Code2, Database, Lock, Mail, Palette, Zap, Server, Shield, Layers } from 'lucide-react'

function Home() {
  const { user, isLoading } = useAuth()
  const t = useTranslations('home')

  const techStack = [
    { name: 'Next.js 15', icon: <Zap className="w-4 h-4" />, badge: t('techStack.appRouter') },
    { name: 'React 19 + TypeScript', icon: <Code2 className="w-4 h-4" />, badge: t('techStack.latest') },
    { name: 'Better Auth', icon: <Lock className="w-4 h-4" />, badge: t('techStack.secure') },
    { name: 'PostgreSQL', icon: <Database className="w-4 h-4" />, badge: t('techStack.supabase') },
    { name: 'TanStack Query', icon: <Server className="w-4 h-4" />, badge: t('techStack.v5') },
    { name: 'shadcn/ui', icon: <Palette className="w-4 h-4" />, badge: t('techStack.components') },
    { name: 'React Hook Form + Zod', icon: <Shield className="w-4 h-4" />, badge: t('techStack.validation') },
    { name: 'Tailwind CSS v4', icon: <Layers className="w-4 h-4" />, badge: t('techStack.styling') },
  ]

  const features = [
    { name: t('features.emailAuth'), icon: <Mail className="w-4 h-4 text-blue-500" /> },
    { name: t('features.googleOAuth'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.protectedRoutes'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.emailVerification'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.passwordReset'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.entityManagement'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.pluginSystem'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.themeSupport'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.i18nSystem'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.apiRoutes'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.colorMode'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" /> },
    { name: t('features.aiIntegration'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />, badge: 'Coming Soon' },
    { name: t('features.teams'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />, badge: 'Coming Soon' },
    { name: t('features.memberships'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />, badge: 'Coming Soon' },
    { name: t('features.amplitude'), icon: <CheckCircle2 className="w-4 h-4 text-blue-500" />, badge: 'Coming Soon' },
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

        {/* Tech Stack & Features Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="w-5 h-5" />
                {t('techStack.title')}
              </CardTitle>
              <CardDescription>
                {t('techStack.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {techStack.map((tech, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      {tech.icon}
                      <span className="font-medium">{tech.name}</span>
                    </div>
                    <Badge variant="outline">{tech.badge}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      {feature.icon}
                      <span className="text-sm font-medium">{feature.name}</span>
                    </div>
                    {feature.badge && (
                      <Badge variant="secondary" className="text-xs whitespace-nowrap">
                        {feature.badge}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action for Public */}
        {!user && (
          <Card className="mt-8 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4">{t('cta.readyToStart')}</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                {t('cta.description')}
              </p>
              <div className="flex justify-center gap-4">
                <Link href="/pricing">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Palette className="w-4 h-4" />
                    {t('cta.viewPricing')}
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="lg" className="gap-2">
                    <Zap className="w-4 h-4" />
                    {t('cta.startFreeTrial')}
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-muted-foreground">
          <p>{t('footer.builtWith')}</p>
          <p className="mt-2">{t('footer.readyForProduction')}</p>
        </div>
      </div>
    </div>
  )
}

export default Home