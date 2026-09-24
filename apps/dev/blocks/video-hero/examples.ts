import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Video hero with poster image',
    props: {
      title: 'See Our Platform in Action',
      content: 'Watch how leading teams are transforming their workflows with our powerful tools.',
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      posterImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920',
      cta: {
        text: 'Start Free Trial',
        link: '/signup',
        target: '_self',
      },
      backgroundColor: 'gray-900',
      textColor: 'light',
      autoplay: false,
      muted: true,
      loop: true,
    },
  },
]
