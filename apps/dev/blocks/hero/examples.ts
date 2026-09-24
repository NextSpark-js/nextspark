import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Standard hero with dark background',
    props: {
      title: 'Build Your Next Big Idea',
      content: 'The complete platform for launching and scaling your SaaS application. From authentication to payments, we handle the infrastructure so you can focus on building features.',
      cta: {
        text: 'Get Started Free',
        link: '/signup',
        target: '_self',
      },
      backgroundColor: 'gray-900',
      textColor: 'light',
    },
  },
  {
    name: 'With Background Image',
    description: 'Hero with background image overlay',
    props: {
      title: 'Transform Your Business',
      content: 'Join thousands of teams who trust our platform to power their most critical workflows.',
      cta: {
        text: 'Schedule Demo',
        link: '/demo',
        target: '_self',
      },
      backgroundColor: 'gray-900',
      backgroundImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920',
      textColor: 'light',
    },
  },
]
