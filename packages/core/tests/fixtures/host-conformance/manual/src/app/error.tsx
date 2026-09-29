'use client'

export default function CoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div data-probe="core-error">
      <p>Something went wrong.</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  )
}
