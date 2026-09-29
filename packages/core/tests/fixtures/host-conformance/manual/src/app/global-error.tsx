'use client'

export default function CoreGlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <p data-probe="core-global-error">The application failed.</p>
        <button type="button" onClick={() => reset()}>
          Reload
        </button>
      </body>
    </html>
  )
}
