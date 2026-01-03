import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
  BookOpen,
  Code2,
  Database,
  Shield,
  Zap,
  ArrowRight,
  ExternalLink,
  Package,
  Layers,
  Cloud
} from 'lucide-react'
import Link from 'next/link'

function DocsPage() {
  const sections = [
    {
      title: "Getting Started",
      description: "Everything you need to know to get up and running",
      icon: <Zap className="h-6 w-6" />,
      items: [
        { name: "Introduction", href: "/docs/introduction" },
        { name: "Installation", href: "/docs/installation" },
        { name: "Quick Start", href: "/docs/quick-start" },
        { name: "Configuration", href: "/docs/configuration" }
      ]
    },
    {
      title: "Authentication",
      description: "User management and security features",
      icon: <Shield className="h-6 w-6" />,
      items: [
        { name: "Sign Up & Login", href: "/docs/auth/signup-login" },
        { name: "Password Management", href: "/docs/auth/passwords" },
        { name: "Two-Factor Auth", href: "/docs/auth/2fa" },
        { name: "OAuth Providers", href: "/docs/auth/oauth" }
      ]
    },
    {
      title: "Dashboard Features",
      description: "Core functionality and features",
      icon: <Layers className="h-6 w-6" />,
      items: [
        { name: "Task Management", href: "/docs/features/tasks" },
        { name: "User Profile", href: "/docs/features/profile" },
        { name: "Settings", href: "/docs/features/settings" },
        { name: "Notifications", href: "/docs/features/notifications" }
      ]
    },
    {
      title: "API Reference",
      description: "Complete API documentation",
      icon: <Code2 className="h-6 w-6" />,
      items: [
        { name: "Authentication", href: "/docs/api/auth" },
        { name: "Users", href: "/docs/api/users" },
        { name: "Tasks", href: "/docs/api/tasks" },
        { name: "Rate Limiting", href: "/docs/api/rate-limiting" }
      ]
    },
    {
      title: "Database",
      description: "Schema and data management",
      icon: <Database className="h-6 w-6" />,
      items: [
        { name: "Schema Overview", href: "/docs/database/schema" },
        { name: "Migrations", href: "/docs/database/migrations" },
        { name: "Backup & Restore", href: "/docs/database/backup" },
        { name: "Performance", href: "/docs/database/performance" }
      ]
    },
    {
      title: "Deployment",
      description: "Deploy to production",
      icon: <Cloud className="h-6 w-6" />,
      items: [
        { name: "Vercel", href: "/docs/deployment/vercel" },
        { name: "Docker", href: "/docs/deployment/docker" },
        { name: "Environment Variables", href: "/docs/deployment/env" },
        { name: "SSL & Security", href: "/docs/deployment/security" }
      ]
    }
  ]

  const techStack = [
    {
      name: "Next.js 15",
      description: "React framework with App Router",
      icon: <Package className="h-5 w-5" />,
      docs: "https://nextjs.org/docs"
    },
    {
      name: "Better Auth",
      description: "Modern authentication library",
      icon: <Shield className="h-5 w-5" />,
      docs: "https://better-auth.com"
    },
    {
      name: "PostgreSQL",
      description: "Robust relational database",
      icon: <Database className="h-5 w-5" />,
      docs: "https://supabase.com/docs"
    },
    {
      name: "TanStack Query",
      description: "Powerful data synchronization",
      icon: <Zap className="h-5 w-5" />,
      docs: "https://tanstack.com/query"
    },
    {
      name: "shadcn/ui",
      description: "Beautiful UI components",
      icon: <Layers className="h-5 w-5" />,
      docs: "https://ui.shadcn.com"
    },
    {
      name: "TypeScript",
      description: "Type-safe JavaScript",
      icon: <Code2 className="h-5 w-5" />,
      docs: "https://www.typescriptlang.org/docs"
    }
  ]

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-600 px-3 py-1 rounded-full text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Documentation
        </div>
        <h1 className="text-4xl font-bold mb-4">
          Complete Developer Documentation
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Everything you need to build, deploy, and scale your application with our modern full-stack boilerplate.
        </p>
      </div>

      {/* Documentation Sections */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Documentation Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section, index) => (
            <Card key={index} className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {section.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                </div>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>
                      <Link 
                        href={item.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 group"
                      >
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Technology Stack</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {techStack.map((tech, index) => (
            <Card key={index} className="group hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/10 rounded-lg text-green-600">
                    {tech.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{tech.name}</h3>
                    <p className="text-sm text-muted-foreground">{tech.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={tech.docs} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    </div>
  )
}

export default DocsPage