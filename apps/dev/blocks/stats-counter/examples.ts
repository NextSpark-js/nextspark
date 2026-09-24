import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Light Background',
    description: 'Stats counter with light background',
    props: {
      title: 'Trusted by Thousands',
      content: 'Join a growing community of successful businesses',
      backgroundColor: 'gray-50',
      stats: [
        {
          value: '10,000+',
          label: 'Active Users',
          description: 'Growing daily',
        },
        {
          value: '99.9%',
          label: 'Uptime',
          description: 'Reliable service',
        },
        {
          value: '50M+',
          label: 'API Requests',
          description: 'Processed monthly',
        },
        {
          value: '4.9/5',
          label: 'Customer Rating',
          description: 'From 2,000+ reviews',
        },
      ],
    },
  },
  {
    name: 'Dark Background',
    description: 'Stats counter with dark background',
    props: {
      title: 'The Numbers Speak',
      content: 'Real results from real customers',
      backgroundColor: 'gray-900',
      stats: [
        {
          value: '$2.5M+',
          label: 'Revenue Generated',
          description: 'For our customers',
        },
        {
          value: '150+',
          label: 'Countries',
          description: 'Worldwide reach',
        },
        {
          value: '24/7',
          label: 'Support',
          description: 'Always available',
        },
      ],
    },
  },
]
