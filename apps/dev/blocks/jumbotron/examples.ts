import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Standard jumbotron with centered content',
    props: {
      title: 'Welcome to Our Platform',
      content: 'Discover powerful tools designed to help your team collaborate more effectively and achieve better results.',
      cta: {
        text: 'Learn More',
        link: '/features',
        target: '_self',
      },
      backgroundColor: 'gray-50',
      textColor: 'dark',
      fullscreen: false,
    },
  },
  {
    name: 'Fullscreen',
    description: 'Fullscreen jumbotron with vertical centering',
    props: {
      title: 'Your Success Starts Here',
      content: 'Experience the difference with our comprehensive suite of business tools.',
      cta: {
        text: 'Get Started',
        link: '/signup',
        target: '_self',
      },
      backgroundColor: 'primary',
      textColor: 'light',
      fullscreen: true,
    },
  },
]
