'use client'

import { useState } from 'react'

export default function CounterPage() {
  const [count, setCount] = useState(0)
  return (
    <div data-probe="client-counter">
      <p>Count: {count}</p>
      <button type="button" onClick={() => setCount(value => value + 1)}>
        Increment
      </button>
    </div>
  )
}
