/**
 * @jest-environment jsdom
 *
 * #500: a block card whose thumbnail is a flat fill, or fails to load, shows the "no preview" placeholder.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BlockThumbnail, isUniformImage } from '../../../../src/components/devtools/BlockThumbnail'

afterEach(cleanup)

describe('isUniformImage', () => {
  test('a flat fill is uniform, any drawn pixel is not', () => {
    expect(isUniformImage(new Uint8ClampedArray([229, 231, 235, 255, 229, 231, 235, 255, 229, 231, 235, 255]))).toBe(true)
    expect(isUniformImage(new Uint8ClampedArray([229, 231, 235, 255, 229, 231, 235, 255, 10, 231, 235, 255]))).toBe(false)
  })
})

describe('BlockThumbnail', () => {
  test('shows the image when there is a src', () => {
    render(<BlockThumbnail src="/t.png" alt="Hero" emptyLabel="No preview" />)
    expect(screen.getByAltText('Hero')).toBeTruthy()
    expect(screen.queryByText('No preview')).toBeNull()
  })

  test('shows the placeholder when there is no src', () => {
    render(<BlockThumbnail alt="Hero" emptyLabel="No preview" />)
    expect(screen.getByText('No preview')).toBeTruthy()
  })

  test('falls back to the placeholder when the image fails to load', () => {
    render(<BlockThumbnail src="/missing.png" alt="Hero" emptyLabel="No preview" />)
    fireEvent.error(screen.getByAltText('Hero'))
    expect(screen.getByText('No preview')).toBeTruthy()
    expect(screen.queryByAltText('Hero')).toBeNull()
  })

  test('falls back to the placeholder when the loaded image is a flat fill', () => {
    const flat = new Uint8ClampedArray(16 * 9 * 4).fill(200)
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = (() => ({
      drawImage: () => {},
      getImageData: () => ({ data: flat }),
    })) as unknown as typeof original
    try {
      render(<BlockThumbnail src="/blank.png" alt="Hero" emptyLabel="No preview" />)
      fireEvent.load(screen.getByAltText('Hero'))
      expect(screen.getByText('No preview')).toBeTruthy()
    } finally {
      HTMLCanvasElement.prototype.getContext = original
    }
  })
})
