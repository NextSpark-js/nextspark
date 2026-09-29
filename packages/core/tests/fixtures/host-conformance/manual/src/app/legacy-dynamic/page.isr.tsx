export const dynamic = 'force-dynamic'
export const maxDuration = 15

export default async function LegacyDynamicPage() {
  return <p data-probe="legacy-dynamic">Rendered per request at {new Date().toISOString()}</p>
}
