import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Image Left',
    description: 'Split layout with image on left',
    props: {
      title: 'Built for Teams',
      content: 'Collaborate seamlessly with powerful tools designed for modern workplaces. Share ideas, track progress, and achieve more together.',
      imageUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
      imageAlt: 'Team collaboration',
      imagePosition: 'left',
      cta: {
        text: 'Learn More',
        link: '/features',
        target: '_self',
      },
      backgroundColor: 'white',
    },
  },
  {
    name: 'Image Right',
    description: 'Split layout with image on right',
    props: {
      title: 'Analytics That Matter',
      content: 'Make data-driven decisions with comprehensive analytics and reporting. Gain insights into user behavior, track key metrics, and optimize your strategy.',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800',
      imageAlt: 'Analytics dashboard',
      imagePosition: 'right',
      cta: {
        text: 'View Dashboard',
        link: '/analytics',
        target: '_self',
      },
      backgroundColor: 'gray-50',
    },
  },
]
