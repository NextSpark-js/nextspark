import { ImageResponse } from 'next/og'

// A second icon: Next's numbered metadata variant (icon1).
export const size = { width: 48, height: 48 }
export const contentType = 'image/png'

export default function SecondIcon() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', background: '#654321' }} />, size)
}
