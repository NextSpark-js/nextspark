
import { getPublicTranslations } from '@nextsparkjs/core/lib/i18n/public-translations'

// Default public page component  
async function DefaultPublicPage() {
  const t = await getPublicTranslations('public.defaultPage')
  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('description')}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">
              {t('template')}
            </p>
            <p className="text-sm text-blue-600 mt-1">
              {t('path', { path: 'app/public/page.tsx' })}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

// Export the resolved component (theme override or default)
export default DefaultPublicPage