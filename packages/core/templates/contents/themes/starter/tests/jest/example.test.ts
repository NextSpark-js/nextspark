/**
 * Example Jest Test
 *
 * This file demonstrates how to write Jest tests for your theme.
 * Run tests with: pnpm test:theme
 *
 * Test Organization:
 * - Create test files with .test.ts or .spec.ts extension
 * - Group related tests in describe blocks
 * - Use meaningful test names that describe the expected behavior
 */

import { render, screen } from '@testing-library/react'

// Example: Testing a simple utility function
describe('Example Utility Tests', () => {
  it('should demonstrate a simple passing test', () => {
    const sum = (a: number, b: number) => a + b
    expect(sum(2, 3)).toBe(5)
  })

  it('should work with async/await', async () => {
    const fetchData = async () => ({ status: 'ok' })
    const result = await fetchData()
    expect(result.status).toBe('ok')
  })
})

// Example: Testing with mocked fetch
describe('API Mock Tests', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('should mock fetch responses', async () => {
    const mockData = { users: ['Alice', 'Bob'] }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    })

    const response = await fetch('/api/users')
    const data = await response.json()

    expect(data.users).toHaveLength(2)
    expect(data.users).toContain('Alice')
  })
})

// Example: Testing React components
describe('React Component Tests', () => {
  it('should render a simple component', () => {
    const SimpleComponent = () => <div data-testid="greeting">Hello World</div>

    render(<SimpleComponent />)

    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello World')
  })

  it('should use jest-dom matchers', () => {
    const Button = ({ disabled }: { disabled: boolean }) => (
      <button disabled={disabled}>Click me</button>
    )

    render(<Button disabled={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Click me')
  })
})

// Example: Testing with theme imports
describe('Theme Integration Tests', () => {
  // You can import theme utilities and test them
  // import { formatDate } from '../../lib/utils'

  it('should work with theme utilities', () => {
    // Example test placeholder
    // const formatted = formatDate(new Date('2024-01-15'))
    // expect(formatted).toBe('January 15, 2024')
    expect(true).toBe(true)
  })
})
