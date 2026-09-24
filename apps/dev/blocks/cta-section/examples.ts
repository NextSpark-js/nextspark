import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Primary CTA',
    description: 'Single primary call-to-action',
    props: {
      title: 'Ready to Get Started?',
      content: 'Join thousands of teams already using our platform to accelerate their growth.',
      primaryCta: {
        text: 'Start Free Trial',
        link: '/signup',
        target: '_self',
      },
      backgroundColor: 'primary',
      textColor: 'light',
      alignment: 'center',
    },
  },
  {
    name: 'With Secondary CTA',
    description: 'Primary and secondary CTAs',
    props: {
      title: 'Transform Your Workflow',
      content: 'Experience the difference with our comprehensive suite of tools. No credit card required.',
      primaryCta: {
        text: 'Get Started Free',
        link: '/signup',
        target: '_self',
      },
      secondaryCta: {
        text: 'Schedule Demo',
        link: '/demo',
        target: '_self',
      },
      backgroundColor: 'gray-900',
      textColor: 'light',
      alignment: 'center',
    },
  },
]
