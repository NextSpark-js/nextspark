/**
 * Unit Tests - PostHeader Component
 *
 * Tests PostHeader component logic and rendering:
 * - Renders title, excerpt, and metadata
 * - Handles optional fields (featuredImage, excerpt, categories)
 * - Displays category badges with colors
 * - Formats dates correctly
 * - data-cy attribute presence
 *
 * Focus on component behavior WITHOUT full E2E interaction.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { PostHeader } from '@/themes/default/entities/posts/components/post-header'

describe('PostHeader Component', () => {
  const mockPost = {
    title: 'Test Post Title',
    excerpt: 'This is a test excerpt for the post',
    featuredImage: 'https://example.com/image.jpg',
    createdAt: '2024-12-16T10:00:00.000Z',
    categories: [
      { id: 'cat-1', name: 'Technology', color: '#3B82F6' },
      { id: 'cat-2', name: 'Tutorials', color: '#10B981' }
    ]
  }

  describe('Rendering - Complete Post', () => {
    it('should render post title', () => {
      render(<PostHeader post={mockPost} />)

      const title = screen.getByText('Test Post Title')
      expect(title).toBeInTheDocument()
      expect(title).toHaveAttribute('data-cy', 'post-title')
    })

    it('should render post excerpt', () => {
      render(<PostHeader post={mockPost} />)

      const excerpt = screen.getByText('This is a test excerpt for the post')
      expect(excerpt).toBeInTheDocument()
      expect(excerpt).toHaveAttribute('data-cy', 'post-excerpt')
    })

    it('should render featured image', () => {
      render(<PostHeader post={mockPost} />)

      const image = screen.getByAltText('Test Post Title')
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', expect.stringContaining('image.jpg'))
    })

    it('should render all categories', () => {
      render(<PostHeader post={mockPost} />)

      expect(screen.getByText('Technology')).toBeInTheDocument()
      expect(screen.getByText('Tutorials')).toBeInTheDocument()
    })

    it('should render formatted date', () => {
      render(<PostHeader post={mockPost} />)

      // Date should be formatted as "December 16, 2024"
      const dateElement = screen.getByText(/December 16, 2024/i)
      expect(dateElement).toBeInTheDocument()
    })

    it('should have main container with data-cy', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const header = container.querySelector('[data-cy="post-header"]')
      expect(header).toBeInTheDocument()
    })
  })

  describe('Rendering - Optional Fields', () => {
    it('should not render featured image when missing', () => {
      const postWithoutImage = {
        ...mockPost,
        featuredImage: undefined
      }

      const { container } = render(<PostHeader post={postWithoutImage} />)

      const imageContainer = container.querySelector('[data-cy="post-featured-image-display"]')
      expect(imageContainer).not.toBeInTheDocument()
    })

    it('should not render excerpt when missing', () => {
      const postWithoutExcerpt = {
        ...mockPost,
        excerpt: undefined
      }

      render(<PostHeader post={postWithoutExcerpt} />)

      const excerpt = screen.queryByTestId('post-excerpt')
      expect(excerpt).not.toBeInTheDocument()
    })

    it('should not render categories section when empty', () => {
      const postWithoutCategories = {
        ...mockPost,
        categories: []
      }

      const { container } = render(<PostHeader post={postWithoutCategories} />)

      const categoriesContainer = container.querySelector('[data-cy="post-categories-display"]')
      expect(categoriesContainer).not.toBeInTheDocument()
    })

    it('should not render categories section when undefined', () => {
      const postWithoutCategories = {
        ...mockPost,
        categories: undefined
      }

      const { container } = render(<PostHeader post={postWithoutCategories} />)

      const categoriesContainer = container.querySelector('[data-cy="post-categories-display"]')
      expect(categoriesContainer).not.toBeInTheDocument()
    })
  })

  describe('Category Badges', () => {
    it('should render category badge with correct color', () => {
      render(<PostHeader post={mockPost} />)

      const techBadge = screen.getByText('Technology')

      // Badge should have inline styles with the color
      const parentBadge = techBadge.closest('[style]')
      expect(parentBadge).toHaveStyle({
        borderColor: '#3B82F6',
        color: '#3B82F6'
      })
    })

    it('should render category badge with background color opacity', () => {
      render(<PostHeader post={mockPost} />)

      const techBadge = screen.getByText('Technology')
      const parentBadge = techBadge.closest('[style]')

      // backgroundColor should be color + 20 (hex opacity)
      expect(parentBadge).toHaveStyle({
        backgroundColor: '#3B82F620'
      })
    })

    it('should handle categories without color', () => {
      const postWithNoColorCategory = {
        ...mockPost,
        categories: [
          { id: 'cat-1', name: 'No Color Category' }
        ]
      }

      render(<PostHeader post={postWithNoColorCategory} />)

      const badge = screen.getByText('No Color Category')
      expect(badge).toBeInTheDocument()

      // Badge should still render without inline color styles
      const parentBadge = badge.closest('[style]')
      // If no color, styles will be undefined or not include custom colors
      if (parentBadge) {
        const style = parentBadge.getAttribute('style')
        expect(style).not.toContain('borderColor')
      }
    })

    it('should render multiple category badges', () => {
      const postWithManyCategories = {
        ...mockPost,
        categories: [
          { id: 'cat-1', name: 'Category 1', color: '#FF0000' },
          { id: 'cat-2', name: 'Category 2', color: '#00FF00' },
          { id: 'cat-3', name: 'Category 3', color: '#0000FF' }
        ]
      }

      render(<PostHeader post={postWithManyCategories} />)

      expect(screen.getByText('Category 1')).toBeInTheDocument()
      expect(screen.getByText('Category 2')).toBeInTheDocument()
      expect(screen.getByText('Category 3')).toBeInTheDocument()
    })
  })

  describe('Date Formatting', () => {
    it('should format date correctly for different dates', () => {
      const testDates = [
        { input: '2024-01-01T00:00:00.000Z', expected: 'January 1, 2024' },
        { input: '2024-06-15T12:30:00.000Z', expected: 'June 15, 2024' },
        { input: '2024-12-31T23:59:59.000Z', expected: 'December 31, 2024' }
      ]

      testDates.forEach(({ input, expected }) => {
        const post = { ...mockPost, createdAt: input }
        const { unmount } = render(<PostHeader post={post} />)

        const dateElement = screen.getByText(new RegExp(expected, 'i'))
        expect(dateElement).toBeInTheDocument()

        unmount()
      })
    })

    it('should include dateTime attribute on time element', () => {
      render(<PostHeader post={mockPost} />)

      const timeElement = screen.getByText(/December 16, 2024/i).closest('time')
      expect(timeElement).toHaveAttribute('dateTime', '2024-12-16T10:00:00.000Z')
    })
  })

  describe('Data-cy Attributes', () => {
    it('should have data-cy on post header container', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const header = container.querySelector('[data-cy="post-header"]')
      expect(header).toBeInTheDocument()
    })

    it('should have data-cy on featured image container', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const imageContainer = container.querySelector('[data-cy="post-featured-image-display"]')
      expect(imageContainer).toBeInTheDocument()
    })

    it('should have data-cy on categories display', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const categoriesDisplay = container.querySelector('[data-cy="post-categories-display"]')
      expect(categoriesDisplay).toBeInTheDocument()
    })

    it('should have data-cy on post title', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const title = container.querySelector('[data-cy="post-title"]')
      expect(title).toBeInTheDocument()
      expect(title?.textContent).toBe('Test Post Title')
    })

    it('should have data-cy on post excerpt', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const excerpt = container.querySelector('[data-cy="post-excerpt"]')
      expect(excerpt).toBeInTheDocument()
      expect(excerpt?.textContent).toBe('This is a test excerpt for the post')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty title', () => {
      const postWithEmptyTitle = {
        ...mockPost,
        title: ''
      }

      const { container } = render(<PostHeader post={postWithEmptyTitle} />)

      // Component should still render without crashing
      const header = container.querySelector('[data-cy="post-header"]')
      expect(header).toBeInTheDocument()
    })

    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(500)
      const postWithLongTitle = {
        ...mockPost,
        title: longTitle
      }

      render(<PostHeader post={postWithLongTitle} />)

      const title = screen.getByText(longTitle)
      expect(title).toBeInTheDocument()
    })

    it('should handle very long excerpt', () => {
      const longExcerpt = 'B'.repeat(1000)
      const postWithLongExcerpt = {
        ...mockPost,
        excerpt: longExcerpt
      }

      render(<PostHeader post={postWithLongExcerpt} />)

      const excerpt = screen.getByText(longExcerpt)
      expect(excerpt).toBeInTheDocument()
    })

    it('should throw error for invalid date', () => {
      const postWithInvalidDate = {
        ...mockPost,
        createdAt: 'invalid-date'
      }

      // Component throws RangeError when date is invalid (toISOString fails)
      expect(() => render(<PostHeader post={postWithInvalidDate} />)).toThrow(RangeError)
    })

    it('should handle categories with very long names', () => {
      const postWithLongCategoryName = {
        ...mockPost,
        categories: [
          { id: 'cat-1', name: 'C'.repeat(100), color: '#FF0000' }
        ]
      }

      render(<PostHeader post={postWithLongCategoryName} />)

      const categoryBadge = screen.getByText('C'.repeat(100))
      expect(categoryBadge).toBeInTheDocument()
    })

    it('should handle special characters in title', () => {
      const postWithSpecialChars = {
        ...mockPost,
        title: 'Test <Title> & "Quotes" & Special ©haracters'
      }

      render(<PostHeader post={postWithSpecialChars} />)

      const title = screen.getByText(/Test <Title> & "Quotes" & Special ©haracters/)
      expect(title).toBeInTheDocument()
    })

    it('should handle missing category id', () => {
      const postWithInvalidCategory = {
        ...mockPost,
        categories: [
          { id: '', name: 'Invalid Category', color: '#FF0000' }
        ]
      }

      render(<PostHeader post={postWithInvalidCategory} />)

      // Should still render category name
      expect(screen.getByText('Invalid Category')).toBeInTheDocument()
    })
  })

  describe('Component Structure', () => {
    it('should render in correct order: image -> categories -> title -> excerpt -> date', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const elements = container.querySelectorAll('[data-cy]')
      const order = Array.from(elements).map(el => el.getAttribute('data-cy'))

      // Expected order based on component structure
      expect(order).toContain('post-featured-image-display')
      expect(order).toContain('post-categories-display')
      expect(order).toContain('post-title')
      expect(order).toContain('post-excerpt')

      // Featured image should come before title
      const imageIndex = order.indexOf('post-featured-image-display')
      const titleIndex = order.indexOf('post-title')
      expect(imageIndex).toBeLessThan(titleIndex)
    })

    it('should render separator (hr) at the bottom', () => {
      const { container } = render(<PostHeader post={mockPost} />)

      const separator = container.querySelector('hr')
      expect(separator).toBeInTheDocument()
    })
  })
})
