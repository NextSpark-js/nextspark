import type { ReactNode } from 'react'

// Cache Components host only: this segment reads runtime params and is allowed to block
// (legacy ISR host: the same page renders on demand without this layout).
export const instant = false

export default function BlockingSegmentLayout({ children }: { children: ReactNode }) {
  return children
}
