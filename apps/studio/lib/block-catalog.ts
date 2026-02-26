/**
 * Block Catalog
 *
 * Static catalog of all available page builder blocks from the default theme.
 * Used by the visual block picker and page editor.
 */

export type BlockCategory = 'headers' | 'content' | 'features' | 'social-proof' | 'pricing' | 'cta' | 'faq'

export interface BlockCatalogItem {
  type: string
  label: string
  category: BlockCategory
  description: string
  icon: string
  defaultProps: Record<string, unknown>
}

export const BLOCK_CATEGORIES: { id: BlockCategory; label: string }[] = [
  { id: 'headers', label: 'Headers' },
  { id: 'content', label: 'Content' },
  { id: 'features', label: 'Features' },
  { id: 'social-proof', label: 'Social Proof' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'cta', label: 'CTA' },
  { id: 'faq', label: 'FAQ' },
]

export const BLOCK_CATALOG: BlockCatalogItem[] = [
  // ── Headers ──
  {
    type: 'hero',
    label: 'Hero Section',
    category: 'headers',
    description: 'Full-width hero with title, subtitle, and CTA button',
    icon: 'Rocket',
    defaultProps: {
      title: 'Welcome to Our Platform',
      content: 'The best solution for your business needs.',
      cta: { text: 'Get Started', link: '/auth/sign-up' },
      textColor: 'light',
    },
  },
  {
    type: 'hero-with-form',
    label: 'Hero With Form',
    category: 'headers',
    description: 'Hero with lead capture form card on the right',
    icon: 'FileText',
    defaultProps: {
      title: 'Start Your Free Trial',
      content: 'Get started in minutes. No credit card required.',
      formTitle: 'Sign Up',
    },
  },
  {
    type: 'jumbotron',
    label: 'Jumbotron',
    category: 'headers',
    description: 'Large hero block with optional fullscreen mode',
    icon: 'Maximize2',
    defaultProps: {
      title: 'Build Something Amazing',
      content: 'Create powerful applications with ease.',
      cta: { text: 'Learn More', link: '#features' },
      fullscreen: false,
    },
  },
  {
    type: 'video-hero',
    label: 'Video Hero',
    category: 'headers',
    description: 'Hero section with embedded YouTube/Vimeo video',
    icon: 'Video',
    defaultProps: {
      title: 'See It In Action',
      content: 'Watch how our platform works.',
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      videoPosition: 'inline',
    },
  },

  // ── Content ──
  {
    type: 'text-content',
    label: 'Text Content',
    category: 'content',
    description: 'Rich text content for paragraphs and formatted text',
    icon: 'FileText',
    defaultProps: {
      title: 'About Us',
      content: 'We are a team of passionate developers building the future of SaaS.',
    },
  },
  {
    type: 'split-content',
    label: 'Split Content',
    category: 'content',
    description: 'Two-column section with image and text',
    icon: 'LayoutGrid',
    defaultProps: {
      title: 'Why Choose Us',
      content: 'We provide the best tools for your business.',
      imagePosition: 'right',
      cta: { text: 'Learn More', link: '/about' },
    },
  },
  {
    type: 'timeline',
    label: 'Timeline',
    category: 'content',
    description: 'Chronological events, process steps, or history',
    icon: 'GitBranch',
    defaultProps: {
      title: 'Our Journey',
      items: [
        { title: 'Founded', description: 'Started with a vision', date: '2020' },
        { title: 'Launch', description: 'Released our first product', date: '2021' },
        { title: 'Growth', description: 'Reached 10,000 users', date: '2023' },
      ],
    },
  },
  {
    type: 'logo-cloud',
    label: 'Logo Cloud',
    category: 'content',
    description: 'Client/partner logos ("Trusted by...")',
    icon: 'Building2',
    defaultProps: {
      title: 'Trusted by Leading Companies',
      items: [
        { name: 'Company A' },
        { name: 'Company B' },
        { name: 'Company C' },
      ],
    },
  },
  {
    type: 'post-content',
    label: 'Post Content',
    category: 'content',
    description: 'Long-form blog content with editorial styling',
    icon: 'FileText',
    defaultProps: {
      title: 'Blog Post Title',
      content: 'Your long-form content goes here...',
    },
  },

  // ── Features ──
  {
    type: 'features-grid',
    label: 'Features Grid',
    category: 'features',
    description: 'Grid of features with icons and descriptions',
    icon: 'Grid',
    defaultProps: {
      title: 'Key Features',
      columns: '3',
      items: [
        { icon: 'Zap', title: 'Fast', description: 'Lightning fast performance' },
        { icon: 'Shield', title: 'Secure', description: 'Enterprise-grade security' },
        { icon: 'Heart', title: 'Reliable', description: '99.9% uptime guarantee' },
      ],
    },
  },
  {
    type: 'benefits',
    label: 'Benefits Grid',
    category: 'features',
    description: '3-column benefits grid with colored borders',
    icon: 'LayoutGrid',
    defaultProps: {
      title: 'Benefits',
      items: [
        { icon: 'Clock', title: 'Save Time', description: 'Automate repetitive tasks' },
        { icon: 'TrendingUp', title: 'Grow Faster', description: 'Scale your business' },
        { icon: 'Users', title: 'Collaborate', description: 'Work together seamlessly' },
      ],
    },
  },

  // ── Social Proof ──
  {
    type: 'testimonials',
    label: 'Testimonials',
    category: 'social-proof',
    description: 'Customer testimonials with quotes and authors',
    icon: 'Quote',
    defaultProps: {
      title: 'What Our Customers Say',
      columns: '3',
      items: [
        { quote: 'This product changed our business!', author: 'Jane Smith', role: 'CEO at TechCo' },
        { quote: 'Best tool we have ever used.', author: 'John Doe', role: 'CTO at StartupInc' },
        { quote: 'Incredible value for the price.', author: 'Alice Brown', role: 'Founder at AppLab' },
      ],
    },
  },
  {
    type: 'stats-counter',
    label: 'Stats Counter',
    category: 'social-proof',
    description: 'Key metrics with large numbers and labels',
    icon: 'TrendingUp',
    defaultProps: {
      title: 'Our Impact',
      items: [
        { value: '10,000+', label: 'Active Users' },
        { value: '99.9%', label: 'Uptime' },
        { value: '50+', label: 'Countries' },
        { value: '24/7', label: 'Support' },
      ],
    },
  },

  // ── Pricing ──
  {
    type: 'pricing-table',
    label: 'Pricing Table',
    category: 'pricing',
    description: 'Plan comparison with features and CTA buttons',
    icon: 'DollarSign',
    defaultProps: {
      title: 'Simple, Transparent Pricing',
      content: 'Choose the plan that fits your needs.',
      columns: '3',
      plans: [
        { name: 'Free', price: '$0', period: '/month', features: 'Up to 5 users\nBasic features\nCommunity support', ctaText: 'Get Started' },
        { name: 'Pro', price: '$29', period: '/month', features: 'Unlimited users\nAll features\nPriority support\nAPI access', ctaText: 'Start Free Trial', isPopular: true },
        { name: 'Enterprise', price: 'Custom', features: 'Custom limits\nDedicated support\nSLA guarantee\nCustom integrations', ctaText: 'Contact Sales' },
      ],
    },
  },

  // ── CTA ──
  {
    type: 'cta-section',
    label: 'CTA Section',
    category: 'cta',
    description: 'Call-to-action with title, description, and buttons',
    icon: 'Megaphone',
    defaultProps: {
      title: 'Ready to Get Started?',
      content: 'Join thousands of satisfied customers today.',
      cta: { text: 'Start Free Trial', link: '/auth/sign-up' },
      secondaryButton: { text: 'Contact Sales', link: '/contact', variant: 'outline' },
    },
  },

  // ── FAQ ──
  {
    type: 'faq-accordion',
    label: 'FAQ Accordion',
    category: 'faq',
    description: 'Frequently asked questions with expandable answers',
    icon: 'HelpCircle',
    defaultProps: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions.',
      variant: 'default',
      items: [
        { question: 'How do I get started?', answer: 'Sign up for a free account and follow our onboarding guide.' },
        { question: 'Is there a free trial?', answer: 'Yes! All paid plans include a 14-day free trial.' },
        { question: 'Can I cancel anytime?', answer: 'Absolutely. You can cancel your subscription at any time.' },
      ],
    },
  },
]

/**
 * Get blocks filtered by category
 */
export function getBlocksByCategory(category: BlockCategory): BlockCatalogItem[] {
  return BLOCK_CATALOG.filter(b => b.category === category)
}

/**
 * Find a block by type
 */
export function getBlockByType(type: string): BlockCatalogItem | undefined {
  return BLOCK_CATALOG.find(b => b.type === type)
}
