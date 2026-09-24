import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Vertical',
    description: 'Vertical timeline layout',
    props: {
      title: 'Our Journey',
      content: 'Key milestones in our growth story',
      backgroundColor: 'white',
      orientation: 'vertical',
      events: [
        {
          date: '2020',
          title: 'Company Founded',
          description: 'Started with a vision to transform how teams collaborate',
        },
        {
          date: '2021',
          title: 'First 1,000 Users',
          description: 'Reached our first major milestone and expanded our team',
        },
        {
          date: '2022',
          title: 'Series A Funding',
          description: 'Secured $10M to accelerate product development',
        },
        {
          date: '2023',
          title: 'Global Expansion',
          description: 'Opened offices in 5 countries and reached 10,000+ customers',
        },
        {
          date: '2024',
          title: 'Platform Launch',
          description: 'Launched next-generation platform with AI-powered features',
        },
      ],
    },
  },
  {
    name: 'Horizontal',
    description: 'Horizontal timeline layout',
    props: {
      title: 'Product Roadmap',
      content: 'What we are building next',
      backgroundColor: 'gray-50',
      orientation: 'horizontal',
      events: [
        {
          date: 'Q1 2024',
          title: 'Advanced Analytics',
          description: 'New dashboard with predictive insights',
        },
        {
          date: 'Q2 2024',
          title: 'Mobile Apps',
          description: 'Native iOS and Android applications',
        },
        {
          date: 'Q3 2024',
          title: 'API v2',
          description: 'Enhanced API with GraphQL support',
        },
      ],
    },
  },
]
