import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'
import { BookOpen, MessageCircle, Mail, HelpCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

/**
 * Support Page Template
 *
 * Basic support page with FAQ sections and contact options.
 * Customize the content to match your application's support needs.
 */
function SupportPage() {
  const quickLinks = [
    {
      title: 'Getting Started',
      description: 'Learn the basics of using our platform',
      icon: <BookOpen className="h-6 w-6" />,
      items: ['Creating your account', 'Setting up your profile', 'First steps tutorial'],
    },
    {
      title: 'Account Management',
      description: 'Manage your account settings and preferences',
      icon: <HelpCircle className="h-6 w-6" />,
      items: ['Profile settings', 'Password management', 'Email preferences'],
    },
  ]

  const faqs = [
    {
      question: 'How do I change my password?',
      answer: 'Go to Dashboard > Settings > Password. Enter your current password and then the new password twice to confirm.',
    },
    {
      question: 'Can I switch to dark mode?',
      answer: 'Yes! Use the moon/sun button in the top right corner of any page to toggle between light and dark mode.',
    },
    {
      question: 'How do I contact support?',
      answer: 'You can contact us via email at support@example.com or using the live chat during business hours.',
    },
  ]

  const contactOptions = [
    {
      title: 'Email Support',
      description: 'Get help via email within 24 hours',
      icon: <Mail className="h-6 w-6" />,
      action: 'support@example.com',
      link: 'mailto:support@example.com',
    },
    {
      title: 'Live Chat',
      description: 'Chat with our support team',
      icon: <MessageCircle className="h-6 w-6" />,
      action: 'Start Chat',
      link: '#',
    },
    {
      title: 'Documentation',
      description: 'Browse our complete documentation',
      icon: <BookOpen className="h-6 w-6" />,
      action: 'View Docs',
      link: '/docs',
    },
  ]

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
          <HelpCircle className="h-4 w-4" />
          Support Center
        </div>
        <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Find answers to your questions, learn how to use the platform, and contact our support team.
        </p>
      </div>

      {/* Quick Start Guide */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Quick Start Guides</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickLinks.map((section, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">{section.icon}</div>
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

      {/* FAQ Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
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
        <h2 className="text-2xl font-bold mb-6">Need more help?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contactOptions.map((option, index) => (
            <Card key={index} className="text-center">
              <CardHeader>
                <div className="flex justify-center mb-3">
                  <div className="p-3 bg-primary/10 rounded-full text-primary">{option.icon}</div>
                </div>
                <CardTitle className="text-lg">{option.title}</CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={option.link}>{option.action}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Back to App */}
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Ready to continue using the application?</p>
        <Button asChild>
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}

export default SupportPage
