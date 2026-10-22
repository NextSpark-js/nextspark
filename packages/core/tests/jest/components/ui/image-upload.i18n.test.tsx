/**
 * @jest-environment jsdom
 */

// #338: the ImageUpload copy and validation messages come from the core messages of the active locale
// (`common.imageUpload`), and each one can be replaced with the `labels` prop.

import { describe, test, expect, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImageUpload } from '@/core/components/ui/image-upload'
import * as catalogs from '@/core/messages'

// next-intl is ESM only; this stand-in reads the real core catalog of the locale under test the way useTranslations does
let mockLocale = 'en'
jest.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values: Record<string, unknown> = {}) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const catalog = require('@/core/messages')[mockLocale]
    const text = `${namespace}.${key}`.split('.').reduce((node: any, part) => node?.[part], catalog) as string | undefined
    return text === undefined ? `${namespace}.${key}` : text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]))
  },
}))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

const LOCALES = ['en', 'es', 'de', 'fr', 'it', 'pt'] as const

function renderUpload(locale: string, props: Partial<React.ComponentProps<typeof ImageUpload>> = {}) {
  mockLocale = locale
  const client = new QueryClient()
  return render(
    <QueryClientProvider client={client}>
      <ImageUpload value={[]} onChange={jest.fn()} {...props} />
    </QueryClientProvider>
  )
}

function pick(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImageUpload texts', () => {
  test('English is the text that was there before', () => {
    renderUpload('en')
    expect(screen.getByText(/Drag images here or/)).toBeInTheDocument()
    expect(screen.getByText('click to select')).toBeInTheDocument()
    expect(screen.getByText('Up to 5 images, maximum 5MB each')).toBeInTheDocument()
  })

  test('Spanish shows the Spanish copy', () => {
    renderUpload('es')
    expect(screen.getByText(/Arrastra imágenes aquí o/)).toBeInTheDocument()
    expect(screen.getByText('haz clic para seleccionar')).toBeInTheDocument()
    expect(screen.getByText('Hasta 5 imágenes, máximo 5MB cada una')).toBeInTheDocument()
    expect(screen.queryByText(/Drag images/)).not.toBeInTheDocument()
  })

  test('a single image shows the singular copy', () => {
    renderUpload('es', { maxImages: 1, maxSize: 2 })
    expect(screen.getByText('Una imagen, máximo 2MB cada una')).toBeInTheDocument()
  })

  test.each(LOCALES)('%s has every key and renders no message key', (locale) => {
    const { container } = renderUpload(locale)
    expect(container.textContent).not.toContain('imageUpload')
    const keys = Object.keys((catalogs as unknown as Record<string, { common: { imageUpload: object } }>)[locale].common.imageUpload)
    expect(keys.sort()).toEqual(Object.keys((catalogs as unknown as Record<string, { common: { imageUpload: object } }>).en.common.imageUpload).sort())
  })

  test('a file that is not an image is refused in the active locale', async () => {
    renderUpload('es')
    pick(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await waitFor(() => expect(screen.getByText(/notes\.txt: El archivo debe ser una imagen\./)).toBeInTheDocument())
  })

  test('a file over the size limit is refused in the active locale', async () => {
    renderUpload('en', { maxSize: 1 })
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    pick(big)
    await waitFor(() => expect(screen.getByText(/big\.png: Image is too large\. Maximum 1MB\./)).toBeInTheDocument())
  })
})

describe('ImageUpload labels', () => {
  test('replace the copy and keep the rest in the locale', () => {
    renderUpload('es', {
      labels: { dragHere: 'Suelta tus fotos o', clickToSelect: 'elige', upToImages: (max) => `Máx. ${max} fotos` },
    })
    expect(screen.getByText(/Suelta tus fotos o/)).toBeInTheDocument()
    expect(screen.getByText('elige')).toBeInTheDocument()
    expect(screen.getByText('Máx. 5 fotos, máximo 5MB cada una')).toBeInTheDocument()
  })

  test('replace a validation message', async () => {
    renderUpload('en', { labels: { notImage: 'Images only, please.' } })
    pick(new File(['x'], 'notes.txt', { type: 'text/plain' }))
    await waitFor(() => expect(screen.getByText(/notes\.txt: Images only, please\./)).toBeInTheDocument())
  })
})
