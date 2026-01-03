import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'

// Default public page component  
function DefaultPublicPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Default Public Page
          </h1>
          <p className="text-gray-600 mb-6">
            This is the default public page (no theme override)
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium">
              Default Template
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Path: app/public/page.tsx
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Export the resolved component (theme override or default)
export default getTemplateOrDefault('app/public/page.tsx', DefaultPublicPage)