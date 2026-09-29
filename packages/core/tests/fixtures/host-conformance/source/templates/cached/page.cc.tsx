import { Suspense } from 'react'
import { cacheLife } from 'next/cache'
import { connection } from 'next/server'

async function CachedStamp() {
  'use cache'
  cacheLife('hours')
  return <p data-probe="cached-stamp">Cached at {new Date().toISOString()}</p>
}

async function RequestTime() {
  await connection()
  return <p data-probe="dynamic-hole">Request at {new Date().toISOString()}</p>
}

export default function CachedPage() {
  return (
    <div>
      <CachedStamp />
      <Suspense fallback={<p>Loading the dynamic hole…</p>}>
        <RequestTime />
      </Suspense>
    </div>
  )
}
