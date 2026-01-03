import type { BlockExample } from '@nextsparkjs/core/types/blocks'

export const examples: BlockExample[] = [
  {
    name: 'Default',
    description: 'Logo cloud showing trusted brands',
    props: {
      title: 'Trusted by Leading Companies',
      backgroundColor: 'gray-50',
      logos: [
        {
          name: 'Vercel',
          imageUrl: 'https://assets.vercel.com/image/upload/front/favicon/vercel/180x180.png',
          url: 'https://vercel.com',
        },
        {
          name: 'Next.js',
          imageUrl: 'https://assets.vercel.com/image/upload/v1662130559/nextjs/Icon_dark_background.png',
          url: 'https://nextjs.org',
        },
        {
          name: 'Supabase',
          imageUrl: 'https://supabase.com/brand-assets/supabase-logo-icon.png',
          url: 'https://supabase.com',
        },
        {
          name: 'Stripe',
          imageUrl: 'https://images.ctfassets.net/fzn2n1nzq965/HTTOloNPhisV9P4hlMPNA/cacf1bb88b9fc492dfad34378d844280/Stripe_icon_-_square.svg',
          url: 'https://stripe.com',
        },
      ],
    },
  },
]
