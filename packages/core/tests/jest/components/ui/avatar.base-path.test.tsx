/**
 * An avatar uploaded to the app is asked for under its base path (#198).
 *
 * Radix's Avatar.Image loads the `src` in an off-screen image and renders the
 * <img> only once that load succeeds, so an upload asked for without the base
 * path 404s and the initials stay in its place. The image the browser is asked
 * to load is recorded here, through the whole chain the dashboard and the
 * blocks use: core's AvatarImage, the shared one in @nextsparkjs/ui, Radix.
 */
import { render, screen } from '@testing-library/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/core/components/ui/avatar'
import { TestimonialsBlock as CoreTemplateTestimonials } from '../../../../templates/blocks/testimonials/component'
import { TestimonialsBlock as StarterTestimonials } from '../../../../templates/projects/starter/blocks/testimonials/component'
import { TestimonialsBlock as DefaultThemeTestimonials } from '../../../../../../apps/dev/blocks/testimonials/component'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH
const ORIGINAL_IMAGE = window.Image

let requested: string[] = []

/** An off-screen image that records what it is asked to load, and loads it. */
class RecordingImage extends EventTarget {
  complete = false
  naturalWidth = 0
  referrerPolicy = ''
  crossOrigin: string | null = null
  #src = ''

  get src() {
    return this.#src
  }

  set src(value: string) {
    this.#src = value
    requested.push(value)
    setTimeout(() => {
      this.complete = true
      this.naturalWidth = 1
      this.dispatchEvent(new Event('load'))
    })
  }
}

beforeEach(() => {
  requested = []
  window.Image = RecordingImage as unknown as typeof window.Image
})

afterEach(() => {
  window.Image = ORIGINAL_IMAGE
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

async function avatarSource(src: string | undefined) {
  render(
    <Avatar>
      <AvatarImage src={src} alt="Ada Lovelace" />
      <AvatarFallback>AL</AvatarFallback>
    </Avatar>
  )
  return (await screen.findByRole('img', { name: 'Ada Lovelace' })).getAttribute('src')
}

describe('AvatarImage under a base path', () => {
  beforeEach(() => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
  })

  test('an uploaded avatar is loaded and shown under the base path', async () => {
    expect(await avatarSource('/uploads/avatars/ada.png')).toBe('/base/uploads/avatars/ada.png')
    expect(requested).toEqual(['/base/uploads/avatars/ada.png'])
  })

  test("a sign-in provider's avatar, on another origin, is left as it is", async () => {
    expect(await avatarSource('https://lh3.googleusercontent.com/a/ada=s96-c')).toBe(
      'https://lh3.googleusercontent.com/a/ada=s96-c'
    )
  })

  test('an avatar URL that already carries the base path gets it once', async () => {
    expect(await avatarSource('/base/uploads/avatars/ada.png')).toBe('/base/uploads/avatars/ada.png')
  })

  test('with no avatar, nothing is loaded and the initials show', async () => {
    render(
      <Avatar>
        <AvatarImage src={undefined} alt="Ada Lovelace" />
        <AvatarFallback>AL</AvatarFallback>
      </Avatar>
    )
    expect(await screen.findByText('AL')).toBeInTheDocument()
    expect(requested).toEqual([])
  })

  test.each([
    ['core’s block template', CoreTemplateTestimonials],
    ['the starter theme', StarterTestimonials],
    ['the default theme', DefaultThemeTestimonials],
  ])('the testimonials block of %s shows an uploaded avatar under the base path', async (_, Block) => {
    render(
      <Block
        items={[
          { quote: 'It shipped.', author: 'Ada Lovelace', avatar: '/uploads/temp/ada.png' },
          { quote: 'It scaled.', author: 'Grace Hopper', avatar: 'https://cdn.example.com/grace.png' },
        ]}
      />
    )

    expect((await screen.findByRole('img', { name: 'Ada Lovelace' })).getAttribute('src')).toBe('/base/uploads/temp/ada.png')
    expect((await screen.findByRole('img', { name: 'Grace Hopper' })).getAttribute('src')).toBe('https://cdn.example.com/grace.png')
  })
})

describe('AvatarImage with no base path', () => {
  beforeEach(() => {
    delete process.env.__NEXT_ROUTER_BASEPATH
  })

  test('an uploaded avatar is loaded from the path it was stored with', async () => {
    expect(await avatarSource('/uploads/avatars/ada.png')).toBe('/uploads/avatars/ada.png')
  })
})
