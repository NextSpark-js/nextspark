import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Grid',
    description: 'Testimonials in grid layout',
    props: {
      title: 'What Our Customers Say',
      content: 'Hear from teams who transformed their workflow',
      backgroundColor: 'white',
      layout: 'grid',
      showImages: true,
      testimonials: [
        {
          quote: 'This platform completely changed how we work. The automation features alone save us 10+ hours per week.',
          author: 'Sarah Johnson',
          role: 'VP of Operations',
          company: 'TechCorp',
          image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        },
        {
          quote: 'Best investment we made this year. The ROI was clear within the first month of use.',
          author: 'Michael Chen',
          role: 'CTO',
          company: 'StartupXYZ',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
        },
        {
          quote: 'The support team is incredible. They helped us migrate all our data seamlessly.',
          author: 'Emily Rodriguez',
          role: 'Product Manager',
          company: 'InnovateLabs',
          image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
        },
      ],
    },
  },
  {
    name: 'Carousel',
    description: 'Testimonials in carousel format',
    props: {
      title: 'Customer Success Stories',
      backgroundColor: 'gray-50',
      layout: 'carousel',
      showImages: true,
      autoplay: true,
      testimonials: [
        {
          quote: 'We tried several platforms before finding this one. It is exactly what we needed - powerful yet simple to use.',
          author: 'David Park',
          role: 'CEO',
          company: 'GrowthCo',
          image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
        },
        {
          quote: 'The analytics dashboard gives us insights we never had before. Game changer for our team.',
          author: 'Lisa Thompson',
          role: 'Marketing Director',
          company: 'BrandBuilder',
          image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400',
        },
      ],
    },
  },
]
