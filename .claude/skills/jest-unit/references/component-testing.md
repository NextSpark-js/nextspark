# Component Testing Reference

React component testing patterns with Testing Library and Jest.

## Basic Component Test Structure

```typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '@/core/components/auth/forms/LoginForm'

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('should render login form with all essential elements', () => {
      render(<LoginForm />)

      expect(screen.getByText('Sign In')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    test('should call signIn with correct credentials', async () => {
      const user = userEvent.setup()

      render(<LoginForm />)

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'password123')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        })
      })
    })
  })

  describe('Error Handling', () => {
    test('should display error message on failed login', async () => {
      const user = userEvent.setup()
      mockSignIn.mockRejectedValue(new Error('Invalid credentials'))

      render(<LoginForm />)

      await user.type(screen.getByLabelText('Email'), 'test@example.com')
      await user.type(screen.getByLabelText('Password'), 'wrong')
      await user.click(screen.getByRole('button', { name: /sign in/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    test('should have proper accessibility attributes', () => {
      render(<LoginForm />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('aria-required', 'true')
    })
  })
})
```

---

## userEvent vs fireEvent

### userEvent (Preferred)

```typescript
import userEvent from '@testing-library/user-event'

// ✅ CORRECT - Realistic user interactions
test('user types in input field', async () => {
  const user = userEvent.setup()

  render(<MyComponent />)

  await user.type(screen.getByRole('textbox'), 'Hello')
  await user.click(screen.getByRole('button'))
  await user.keyboard('{Enter}')
  await user.tab()

  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

### fireEvent (Only for Edge Cases)

```typescript
// Use fireEvent only when userEvent doesn't work
// (e.g., custom events, scroll, resize)
test('handles scroll event', () => {
  render(<ScrollComponent />)

  const container = screen.getByTestId('scroll-container')
  fireEvent.scroll(container, { target: { scrollY: 100 } })

  expect(screen.getByText('Scrolled')).toBeInTheDocument()
})
```

---

## Common userEvent Actions

```typescript
const user = userEvent.setup()

// Typing
await user.type(input, 'text')           // Type text
await user.clear(input)                  // Clear input
await user.type(input, 'text{Enter}')    // Type and submit

// Clicking
await user.click(element)                // Single click
await user.dblClick(element)             // Double click
await user.tripleClick(element)          // Triple click (select all)

// Keyboard
await user.keyboard('{Enter}')           // Press Enter
await user.keyboard('{Tab}')             // Press Tab
await user.keyboard('{Escape}')          // Press Escape
await user.keyboard('{ArrowDown}')       // Arrow keys
await user.keyboard('{Shift>}A{/Shift}') // Shift+A

// Selection
await user.selectOptions(select, 'option-value')
await user.selectOptions(select, ['opt1', 'opt2'])  // Multi-select

// Hover
await user.hover(element)
await user.unhover(element)

// Clipboard
await user.copy()
await user.paste()
await user.cut()

// Focus
await user.tab()                         // Move focus forward
await user.tab({ shift: true })          // Move focus backward
```

---

## Query Priority

Testing Library recommends queries in this priority order:

### 1. Accessible to Everyone (Preferred)

```typescript
// By Role (best)
screen.getByRole('button', { name: /submit/i })
screen.getByRole('textbox', { name: /email/i })
screen.getByRole('heading', { level: 1 })

// By Label Text
screen.getByLabelText('Email')

// By Placeholder Text
screen.getByPlaceholderText('Enter email...')

// By Text Content
screen.getByText('Submit')
screen.getByText(/submit/i)  // Case insensitive
```

### 2. Semantic Queries

```typescript
screen.getByAltText('Profile photo')
screen.getByTitle('Close dialog')
screen.getByDisplayValue('current value')
```

### 3. Test IDs (Last Resort)

```typescript
// Only when other queries don't work
screen.getByTestId('complex-component')
screen.getByTestId('data-cy-selector')
```

---

## Async Testing Patterns

### waitFor

```typescript
test('should show loading then data', async () => {
  render(<DataComponent />)

  // Initially loading
  expect(screen.getByText('Loading...')).toBeInTheDocument()

  // Wait for data
  await waitFor(() => {
    expect(screen.getByText('Data loaded')).toBeInTheDocument()
  }, { timeout: 3000 })
})
```

### findBy (Combines getBy + waitFor)

```typescript
test('should load async content', async () => {
  render(<AsyncComponent />)

  // findBy waits for element to appear
  const element = await screen.findByText('Loaded content', {}, { timeout: 5000 })
  expect(element).toBeInTheDocument()
})
```

### waitForElementToBeRemoved

```typescript
test('should hide loading spinner', async () => {
  render(<DataComponent />)

  await waitForElementToBeRemoved(() => screen.queryByText('Loading...'))

  expect(screen.getByText('Data')).toBeInTheDocument()
})
```

---

## Form Testing

### Basic Form

```typescript
test('submits form with correct data', async () => {
  const onSubmit = jest.fn()
  const user = userEvent.setup()

  render(<ContactForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Name'), 'John Doe')
  await user.type(screen.getByLabelText('Email'), 'john@example.com')
  await user.type(screen.getByLabelText('Message'), 'Hello!')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(onSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello!'
  })
})
```

### Form Validation

```typescript
test('shows validation errors', async () => {
  const user = userEvent.setup()

  render(<ContactForm />)

  // Submit empty form
  await user.click(screen.getByRole('button', { name: /submit/i }))

  // Check for validation errors
  expect(await screen.findByText('Name is required')).toBeInTheDocument()
  expect(await screen.findByText('Email is required')).toBeInTheDocument()
})
```

---

## Testing with Context/Providers

```typescript
const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const AllProviders = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )

  return render(ui, { wrapper: AllProviders, ...options })
}

// Usage
test('renders with all providers', () => {
  renderWithProviders(<MyComponent />)
  // ...
})
```

---

## Testing Modals/Dialogs

```typescript
test('opens and closes modal', async () => {
  const user = userEvent.setup()

  render(<ModalComponent />)

  // Open modal
  await user.click(screen.getByRole('button', { name: /open/i }))

  // Check modal is visible
  expect(screen.getByRole('dialog')).toBeInTheDocument()

  // Close modal
  await user.click(screen.getByRole('button', { name: /close/i }))

  // Check modal is gone
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
```

---

## Common Assertions (DOM)

```typescript
// Presence
expect(element).toBeInTheDocument()
expect(element).not.toBeInTheDocument()

// Visibility
expect(element).toBeVisible()
expect(element).not.toBeVisible()

// State
expect(element).toBeDisabled()
expect(element).toBeEnabled()
expect(element).toBeChecked()
expect(element).toHaveFocus()

// Content
expect(element).toHaveTextContent('text')
expect(element).toHaveTextContent(/regex/i)
expect(element).toBeEmpty()

// Attributes
expect(element).toHaveAttribute('href', '/path')
expect(element).toHaveClass('active')
expect(element).toHaveStyle({ color: 'red' })

// Form
expect(input).toHaveValue('value')
expect(input).toHaveDisplayValue('displayed')
expect(select).toHaveValue('option-value')
```
