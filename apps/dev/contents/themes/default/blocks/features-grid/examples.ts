import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: '3 Columns',
    description: 'Feature grid with 3 columns',
    props: {
      title: 'Everything You Need',
      content: 'Powerful features to help you build, launch, and grow your business',
      backgroundColor: 'white',
      columns: '3',
      features: [
        {
          title: 'Team Collaboration',
          description: 'Work together in real-time with your entire team',
          icon: 'Users',
        },
        {
          title: 'Advanced Analytics',
          description: 'Track performance with detailed insights and reports',
          icon: 'BarChart',
        },
        {
          title: 'Automation',
          description: 'Automate workflows and save hours every week',
          icon: 'Zap',
        },
      ],
    },
  },
  {
    name: '4 Columns',
    description: 'Feature grid with 4 columns',
    props: {
      title: 'Complete Feature Set',
      content: 'All the tools you need in one platform',
      backgroundColor: 'gray-50',
      columns: '4',
      features: [
        {
          title: 'Secure Storage',
          description: 'Enterprise-grade encryption for all your files',
          icon: 'Lock',
        },
        {
          title: 'API Access',
          description: 'Build custom integrations with our REST API',
          icon: 'Code',
        },
        {
          title: '24/7 Support',
          description: 'Get help whenever you need it',
          icon: 'MessageCircle',
        },
        {
          title: 'Custom Domains',
          description: 'Use your own domain for branding',
          icon: 'Globe',
        },
      ],
    },
  },
]
