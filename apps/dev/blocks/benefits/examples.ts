import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Bordered',
    description: 'Benefits grid with bordered cards',
    props: {
      sectionTitle: 'Why Choose Our Platform',
      sectionSubtitle: 'Everything you need to succeed, all in one place',
      backgroundColor: 'white',
      cardStyle: 'bordered',
      showColoredBorders: true,
      columns: '3',
      benefits: [
        {
          title: 'Lightning Fast',
          description: 'Optimized for performance with sub-second load times',
          borderColor: '#3b82f6',
        },
        {
          title: 'Secure by Default',
          description: 'Enterprise-grade security with SOC 2 Type II compliance',
          borderColor: '#10b981',
        },
        {
          title: 'Scale Effortlessly',
          description: 'From startup to enterprise, we grow with you',
          borderColor: '#f59e0b',
        },
      ],
    },
  },
  {
    name: 'Elevated',
    description: 'Benefits grid with elevated cards',
    props: {
      sectionTitle: 'Built for Modern Teams',
      sectionSubtitle: 'Collaboration tools that actually work',
      backgroundColor: 'gray-50',
      cardStyle: 'elevated',
      showColoredBorders: false,
      columns: '3',
      benefits: [
        {
          title: 'Real-time Collaboration',
          description: 'Work together seamlessly with live updates',
          borderColor: '#3b82f6',
        },
        {
          title: 'Smart Automation',
          description: 'Automate repetitive tasks and focus on what matters',
          borderColor: '#10b981',
        },
        {
          title: 'Advanced Analytics',
          description: 'Make data-driven decisions with powerful insights',
          borderColor: '#8b5cf6',
        },
      ],
    },
  },
  {
    name: 'Minimal',
    description: 'Minimal benefits layout',
    props: {
      sectionTitle: 'Simple. Powerful. Effective.',
      backgroundColor: 'white',
      cardStyle: 'minimal',
      showColoredBorders: false,
      columns: '3',
      benefits: [
        {
          title: 'Easy Setup',
          description: 'Get started in minutes, not hours',
          borderColor: '#3b82f6',
        },
        {
          title: 'Intuitive Design',
          description: 'No training required, just works',
          borderColor: '#10b981',
        },
      ],
    },
  },
]
