import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Separator } from '@nextsparkjs/core/components/ui/separator'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
  BookOpen,
  MessageCircle,
  Mail,
  ExternalLink,
  Shield,
  Settings,
  User,
  CreditCard,
  HelpCircle,
  CheckCircle2
} from 'lucide-react'
import Link from 'next/link'

function SupportPage() {
  const quickLinks = [
    {
      title: "Getting Started",
      description: "Learn the basics of using our platform",
      icon: <BookOpen className="h-6 w-6" />,
      items: [
        "Creating your account",
        "Setting up your profile", 
        "First steps tutorial",
        "Understanding the dashboard"
      ]
    },
    {
      title: "Account Management",
      description: "Manage your account settings and preferences",
      icon: <User className="h-6 w-6" />,
      items: [
        "Profile settings",
        "Password management",
        "Email preferences",
        "Account deletion"
      ]
    },
    {
      title: "Security & Privacy",
      description: "Keep your account safe and secure",
      icon: <Shield className="h-6 w-6" />,
      items: [
        "Two-factor authentication",
        "Privacy settings",
        "Data protection",
        "Security best practices"
      ]
    },
    {
      title: "Billing & Subscriptions",
      description: "Manage your payments and subscriptions",
      icon: <CreditCard className="h-6 w-6" />,
      items: [
        "Payment methods",
        "Subscription plans",
        "Billing history",
        "Refund policy"
      ]
    }
  ]

  const features = [
    {
      category: "Dashboard Features",
      icon: <Settings className="h-5 w-5" />,
      items: [
        {
          name: "Task Management",
          description: "Create, edit, and organize your tasks efficiently",
          status: "Available"
        },
        {
          name: "Real-time Notifications", 
          description: "Get instant updates about important events",
          status: "Available"
        },
        {
          name: "Dark/Light Mode",
          description: "Switch between themes for comfortable viewing",
          status: "Available"
        },
        {
          name: "Mobile Responsive",
          description: "Access your account from any device",
          status: "Available"
        }
      ]
    },
    {
      category: "Account Settings",
      icon: <User className="h-5 w-5" />,
      items: [
        {
          name: "Profile Management",
          description: "Update your personal information and preferences",
          status: "Available"
        },
        {
          name: "Password Security",
          description: "Change password and manage security settings",
          status: "Available"
        },
        {
          name: "Notification Settings",
          description: "Control how and when you receive notifications",
          status: "Available"
        },
        {
          name: "Privacy Controls",
          description: "Manage your data privacy and visibility settings",
          status: "Available"
        }
      ]
    }
  ]

  const faqs = [
    {
      question: "¿Cómo puedo cambiar mi contraseña?",
      answer: "Ve a Dashboard > Settings > Password. Ingresa tu contraseña actual y luego la nueva contraseña dos veces para confirmarla."
    },
    {
      question: "¿Puedo cambiar mi tema a modo oscuro?",
      answer: "Sí! Usa el botón de luna/sol en la esquina superior derecha de cualquier página para alternar entre modo claro y oscuro."
    },
    {
      question: "¿Cómo administro mis tareas?",
      answer: "Ve a Dashboard > Tasks para ver, crear, editar y eliminar tus tareas. Puedes marcarlas como completadas haciendo clic en el checkbox."
    },
    {
      question: "¿Dónde configuro mis notificaciones?",
      answer: "En Dashboard > Settings > Notifications puedes controlar qué tipos de notificaciones quieres recibir y cómo."
    },
    {
      question: "¿Cómo contacto soporte técnico?",
      answer: "Puedes contactarnos a través del email support@boilerplate.com o usando el chat en vivo durante horarios de oficina."
    },
    {
      question: "¿Mis datos están seguros?",
      answer: "Sí, usamos encriptación de nivel empresarial y seguimos las mejores prácticas de seguridad para proteger tu información."
    }
  ]

  const contactOptions = [
    {
      title: "Email Support",
      description: "Get help via email within 24 hours",
      icon: <Mail className="h-6 w-6" />,
      action: "support@boilerplate.com",
      link: "mailto:support@boilerplate.com"
    },
    {
      title: "Live Chat",
      description: "Chat with our support team",
      icon: <MessageCircle className="h-6 w-6" />,
      action: "Start Chat",
      link: "#"
    },
    {
      title: "Documentation",
      description: "Browse our complete documentation",
      icon: <BookOpen className="h-6 w-6" />,
      action: "View Docs",
      link: "/docs"
    }
  ]

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
          <HelpCircle className="h-4 w-4" />
          Support Center
        </div>
        <h1 className="text-4xl font-bold mb-4">
          ¿Cómo podemos ayudarte?
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Encuentra respuestas a tus preguntas, aprende a usar la plataforma y contacta nuestro equipo de soporte.
        </p>
      </div>

      {/* Quick Start Guide */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Guías de Inicio Rápido</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickLinks.map((section, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    {section.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features Documentation */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Funcionalidades Disponibles</h2>
        <div className="space-y-6">
          {features.map((category, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                    {category.icon}
                  </div>
                  <CardTitle>{category.category}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.items.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start gap-3 p-3 rounded-lg border">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{feature.name}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {feature.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Preguntas Frecuentes</h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{faq.question}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">¿Necesitas más ayuda?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactOptions.map((option, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-primary/10 rounded-full text-primary">
                    {option.icon}
                  </div>
                </div>
                <CardTitle className="text-lg">{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={option.link} target={option.link.startsWith('http') ? '_blank' : undefined}>
                    {option.action}
                    {option.link.startsWith('http') && <ExternalLink className="ml-2 h-4 w-4" />}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Back to App */}
      <div className="text-center">
        <Separator className="mb-6" />
        <p className="text-muted-foreground mb-4">
          ¿Listo para continuar usando la aplicación?
        </p>
        <Button asChild>
          <Link href="/dashboard">
            Volver al Dashboard
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default SupportPage