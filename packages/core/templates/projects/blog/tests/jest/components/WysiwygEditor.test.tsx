import { render, fireEvent } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { WysiwygEditor } from '@/components/editor/WysiwygEditor'

// What a team member can store as a post body through the API.
const STORED = [
  '<p>kept <strong>bold</strong></p>',
  '<img src="x" onerror="globalThis.pwned = 1">',
  '<script>globalThis.pwned = 1</script>',
  '<a href="javascript:globalThis.pwned = 1">link</a>',
].join('')

function expectInert(root: Element) {
  expect(root.querySelector('script')).toBeNull()
  expect(root.querySelector('[onerror]')).toBeNull()
  expect(root.querySelector('a[href^="javascript:"]')).toBeNull()
  expect(root.querySelector('strong')?.textContent).toBe('bold')
}

describe('WysiwygEditor with stored HTML', () => {
  it('renders formatting but no script in the editable area', () => {
    const { container } = render(<WysiwygEditor value={STORED} onChange={jest.fn()} />)
    expectInert(container.querySelector('[contenteditable]')!)
  })

  it('drops script that reaches the editable area while editing', () => {
    const onChange = jest.fn()
    const { container, rerender } = render(<WysiwygEditor value="" onChange={onChange} />)
    const editable = container.querySelector('[contenteditable]')!
    editable.innerHTML = STORED
    fireEvent.input(editable)
    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    rerender(<WysiwygEditor value={emitted} onChange={onChange} />)
    expectInert(editable)
  })

  it('drops a handler the sanitiser only reports as a rewritten attribute', () => {
    const onChange = jest.fn()
    const { container, rerender } = render(<WysiwygEditor value="" onChange={onChange} />)
    const editable = container.querySelector('[contenteditable]')!
    editable.innerHTML = '<p><strong>bold</strong></p><img title=" x " onerror="globalThis.pwned = 1" src="bad">'
    fireEvent.input(editable)
    const emitted = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    rerender(<WysiwygEditor value={emitted} onChange={onChange} />)
    expectInert(editable)
  })

  it('renders formatting but no script in the preview', () => {
    const { container } = render(<WysiwygEditor value={STORED} onChange={jest.fn()} />)
    fireEvent.click(container.querySelector('[data-cy="wysiwyg-preview-toggle"]')!)
    expectInert(container.querySelector('[data-cy="wysiwyg-preview"]')!)
  })
})

describe('WysiwygEditor with markup pasted or dropped in', () => {
  const UNSAFE = '<p><strong>bold</strong></p><img title=" x " onerror="globalThis.pwned = 1" src="bad">'
  const transfer = (html: string) => ({ getData: (type: string) => (type === 'text/html' ? html : '') })
  let execCommand: jest.Mock

  beforeEach(() => {
    execCommand = jest.fn()
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true, writable: true })
  })

  afterEach(() => {
    delete (document as unknown as { execCommand?: unknown }).execCommand
  })

  function expectSanitisedInsertion() {
    expect(execCommand).toHaveBeenCalledTimes(1)
    const [command, , inserted] = execCommand.mock.calls[0]
    expect(command).toBe('insertHTML')
    expect(inserted).toContain('<strong>bold</strong>')
    expect(inserted).not.toContain('onerror')
  }

  it('inserts a paste with a handler sanitised, instead of the browser paste', () => {
    const { container } = render(<WysiwygEditor value="" onChange={jest.fn()} />)
    const proceeded = fireEvent.paste(container.querySelector('[contenteditable]')!, { clipboardData: transfer(UNSAFE) })
    expect(proceeded).toBe(false)
    expectSanitisedInsertion()
  })

  it('inserts a drop with a handler sanitised, instead of the browser drop', () => {
    const { container } = render(<WysiwygEditor value="" onChange={jest.fn()} />)
    const proceeded = fireEvent.drop(container.querySelector('[contenteditable]')!, { dataTransfer: transfer(UNSAFE) })
    expect(proceeded).toBe(false)
    expectSanitisedInsertion()
  })

  it('inserts a paste whose script a document parse would move out of the body, sanitised', () => {
    const { container } = render(<WysiwygEditor value="" onChange={jest.fn()} />)
    const proceeded = fireEvent.paste(container.querySelector('[contenteditable]')!, {
      clipboardData: transfer('<script>globalThis.pwned = 1</script><p><strong>bold</strong></p>'),
    })
    expect(proceeded).toBe(false)
    expectSanitisedInsertion()
    expect(execCommand.mock.calls[0][2]).not.toContain('<script')
  })

  it('leaves a paste with nothing to take out to the browser', () => {
    const { container } = render(<WysiwygEditor value="" onChange={jest.fn()} />)
    const proceeded = fireEvent.paste(container.querySelector('[contenteditable]')!, { clipboardData: transfer('<p>plain <em>text</em></p>') })
    expect(proceeded).toBe(true)
    expect(execCommand).not.toHaveBeenCalled()
  })
})

describe('WysiwygEditor preview toggle', () => {
  it('keeps the content in the editable area after leaving the preview', () => {
    const { container } = render(<WysiwygEditor value="<p>kept <strong>bold</strong></p>" onChange={jest.fn()} />)
    const toggle = container.querySelector('[data-cy="wysiwyg-preview-toggle"]')!
    fireEvent.click(toggle)
    expect(container.querySelector('[contenteditable]')).toBeNull()
    fireEvent.click(toggle)
    expect(container.querySelector('[contenteditable]')!.innerHTML).toBe('<p>kept <strong>bold</strong></p>')
  })
})
