import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Standard FAQ accordion',
    props: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions about our platform',
      backgroundColor: 'white',
      variant: 'default',
      allowMultiple: false,
      defaultOpenFirst: true,
      items: [
        {
          question: 'How does the free trial work?',
          answer: 'Start with our 14-day free trial with full access to all features. No credit card required. Cancel anytime.',
        },
        {
          question: 'Can I upgrade or downgrade my plan?',
          answer: 'Yes, you can change your plan at any time. Changes take effect immediately and we prorate billing automatically.',
        },
        {
          question: 'What kind of support do you offer?',
          answer: 'All plans include email support. Premium plans include priority support with 24/7 availability and dedicated account managers.',
        },
      ],
    },
  },
  {
    name: 'Bordered',
    description: 'FAQ with bordered cards',
    props: {
      title: 'Common Questions',
      backgroundColor: 'gray-50',
      variant: 'bordered',
      allowMultiple: true,
      defaultOpenFirst: true,
      items: [
        {
          question: 'Is my data secure?',
          answer: 'We use industry-standard encryption and are SOC 2 Type II certified. Your data is stored in secure, redundant data centers.',
        },
        {
          question: 'Do you offer team pricing?',
          answer: 'Yes, we have special pricing for teams of 10 or more. Contact our sales team for a custom quote.',
        },
      ],
    },
  },
  {
    name: 'Separated',
    description: 'FAQ with separated items',
    props: {
      title: 'Need Help?',
      subtitle: 'Browse our most asked questions',
      backgroundColor: 'white',
      variant: 'separated',
      allowMultiple: true,
      defaultOpenFirst: false,
      items: [
        {
          question: 'How do I get started?',
          answer: 'Sign up for a free account, complete the onboarding wizard, and start inviting your team members.',
        },
        {
          question: 'Can I import my existing data?',
          answer: 'Yes, we support importing from CSV, Excel, and most major platforms. Our team can help with larger migrations.',
        },
        {
          question: 'What payment methods do you accept?',
          answer: 'We accept all major credit cards, PayPal, and wire transfers for annual plans.',
        },
      ],
    },
  },
]
