import { ImageResponse } from 'next/og'

// Numbered Open Graph variant (opengraph-image2), with alt/size/contentType re-exported.
export const alt = 'Host fixture social card'
export const size = { width: 120, height: 63 }
export const contentType = 'image/png'

export default function SocialCard() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#0a7d3b' }} />, size)
}
