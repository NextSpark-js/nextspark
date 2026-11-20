/**
 * @jest-environment jsdom
 *
 * #500: a block's thumbnail that is missing or fails to load shows the placeholder, in the list and the detail.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BlockThumbnail } from '../../../../src/components/devtools/BlockThumbnail'

afterEach(cleanup)

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

  test('without a label the placeholder is the icon alone', () => {
    const { container } = render(<BlockThumbnail alt="Hero" />)
    expect(container.querySelector('svg')).toBeTruthy()
    expect(container.querySelector('span')).toBeNull()
  })
})
